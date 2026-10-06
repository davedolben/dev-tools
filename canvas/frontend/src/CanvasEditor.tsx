import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type Editor, getSnapshot, loadSnapshot, Tldraw } from 'tldraw'
import { api, type Canvas } from './api'
import { EditableName } from './EditableName'
import {
  customComponents,
  customShapeUtils,
  customTools,
  customUiOverrides,
  registerCustomShapeHandlers,
} from './customShapes'
import { getPrRefreshIntervalMs, startPrAutoRefresh } from './url-card/prRefresh'

const SAVE_DEBOUNCE_MS = 800

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed — retrying',
}

function readTabState() {
  return { visible: !document.hidden, focused: document.hasFocus() }
}

// Debug aid: a hidden tab can't show its own state, so transitions are also logged to the console.
function useTabState() {
  const [state, setState] = useState(readTabState)
  useEffect(() => {
    const update = () => {
      const next = readTabState()
      console.log(`[tab] ${new Date().toLocaleTimeString()} visible=${next.visible} focused=${next.focused}`)
      setState(next)
    }
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
    }
  }, [])
  return state
}

export function CanvasEditor() {
  const { id } = useParams<{ id: string }>()
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [prRefreshedAt, setPrRefreshedAt] = useState<Date | null>(null)
  const tab = useTabState()
  // Re-read on every tab state change, since that's what the cadence depends on.
  const prIntervalMs = getPrRefreshIntervalMs()
  const prCadence = prIntervalMs === null ? 'PRs paused' : `PRs every ${prIntervalMs / 60_000}m`

  useEffect(() => {
    if (!id) return
    setCanvas(null)
    setPrRefreshedAt(null)
    api.getCanvas(id).then(setCanvas, (e) => setLoadError(String(e)))
  }, [id])

  const rename = async (name: string) => {
    if (!canvas) return
    const updated = await api.renameCanvas(canvas.id, name)
    setCanvas((c) => (c ? { ...c, ...updated } : c))
  }

  useEffect(() => {
    if (canvas) document.title = `${canvas.name} · Canvases`
    return () => {
      document.title = 'Canvases'
    }
  }, [canvas])

  return (
    <div className="editor-page">
      <header className="editor-header">
        <Link to="/" className="back-link">
          ← All canvases
        </Link>
        {canvas && <EditableName className="editor-title" value={canvas.name} onSave={rename} />}
        <span
          className={`tab-state ${tab.visible ? 'tab-state-visible' : 'tab-state-hidden'}`}
          title="document.hidden / document.hasFocus(), and the PR refresh cadence they imply"
        >
          {tab.visible ? 'visible' : 'hidden'} · {tab.focused ? 'focused' : 'unfocused'} · {prCadence}
        </span>
        {prRefreshedAt && (
          <span
            className="pr-refresh"
            title="GitHub PR statuses refresh every minute while this canvas is focused, every 10 minutes while it's visible but unfocused, and not at all while it's hidden"
          >
            PRs refreshed {prRefreshedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <span className={`save-state save-state-${saveState}`}>{canvas ? SAVE_LABELS[saveState] : ''}</span>
      </header>
      <div className="editor-canvas">
        {loadError && <p className="error centered">{loadError}</p>}
        {canvas && <AutosavingTldraw
            key={canvas.id}
            canvas={canvas}
            onSaveStateChange={setSaveState}
            onPrRefreshed={setPrRefreshedAt}
          />}
      </div>
    </div>
  )
}

function AutosavingTldraw({
  canvas,
  onSaveStateChange,
  onPrRefreshed,
}: {
  canvas: Canvas
  onSaveStateChange: (state: SaveState) => void
  onPrRefreshed: (at: Date | null) => void
}) {
  const editorRef = useRef<Editor | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const dirty = useRef(false)
  const inFlight = useRef<Promise<void> | null>(null)

  const save = useCallback(
    async (keepalive = false) => {
      const editor = editorRef.current
      if (!editor || !dirty.current) return
      // Serialize saves so an older snapshot can never land after a newer one.
      await inFlight.current
      if (!dirty.current) return
      dirty.current = false
      onSaveStateChange('saving')
      const { document } = getSnapshot(editor.store)
      const request = api.saveSnapshot(canvas.id, document, keepalive).then(
        () => onSaveStateChange(dirty.current ? 'dirty' : 'saved'),
        () => {
          dirty.current = true
          onSaveStateChange('error')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => void save(), 3000)
        },
      )
      inFlight.current = request
      await request
    },
    [canvas.id, onSaveStateChange],
  )

  useEffect(() => {
    const flush = (keepalive: boolean) => {
      window.clearTimeout(timer.current)
      void save(keepalive)
    }
    // keepalive bodies are capped at 64KB, so only use it when the page is actually unloading.
    const onBeforeUnload = () => flush(true)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      flush(false)
    }
  }, [save])

  const onMount = (editor: Editor) => {
    editorRef.current = editor
    // Handy for poking at the editor from the devtools console.
    if (import.meta.env.DEV) Object.assign(window, { editor })
    if (canvas.snapshot) {
      loadSnapshot(editor.store, { document: canvas.snapshot as ReturnType<typeof getSnapshot>['document'] })
      // Like zoomToFit, but never zooms in past 100%.
      const bounds = editor.getCurrentPageBounds()
      if (bounds) editor.zoomToBounds(bounds, { targetZoom: 1 })
    }
    const disposeHandlers = registerCustomShapeHandlers(editor)
    const disposePrRefresh = startPrAutoRefresh(editor, onPrRefreshed)

    const disposeListener = editor.store.listen(
      () => {
        dirty.current = true
        onSaveStateChange('dirty')
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => void save(), SAVE_DEBOUNCE_MS)
      },
      { scope: 'document' },
    )
    return () => {
      disposeHandlers()
      disposePrRefresh()
      disposeListener()
    }
  }

  return (
    <Tldraw
      shapeUtils={customShapeUtils}
      tools={customTools}
      overrides={customUiOverrides}
      components={customComponents}
      onMount={onMount}
    />
  )
}
