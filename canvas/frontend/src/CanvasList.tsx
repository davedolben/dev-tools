import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type CanvasSummary } from './api'
import { EditableName } from './EditableName'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function CanvasList() {
  const [canvases, setCanvases] = useState<CanvasSummary[] | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listCanvases().then(setCanvases, (e) => setError(String(e)))
  }, [])

  const create = async () => {
    const canvas = await api.createCanvas()
    setCanvases((cs) => [canvas, ...(cs ?? [])])
    setRenamingId(canvas.id)
  }

  const rename = async (id: string, name: string) => {
    const updated = await api.renameCanvas(id, name)
    setCanvases((cs) => cs?.map((c) => (c.id === id ? updated : c)) ?? null)
  }

  const remove = async (canvas: CanvasSummary) => {
    if (!confirm(`Delete "${canvas.name}"? This can't be undone.`)) return
    await api.deleteCanvas(canvas.id)
    setCanvases((cs) => cs?.filter((c) => c.id !== canvas.id) ?? null)
  }

  return (
    <div className="list-page">
      <header className="list-header">
        <h1>Canvases</h1>
        <button className="btn btn-primary" onClick={create}>
          + New canvas
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {canvases === null && !error && <p className="muted">Loading…</p>}
      {canvases?.length === 0 && <p className="muted">No canvases yet. Create one to get started.</p>}

      <ul className="canvas-list">
        {canvases?.map((c) => (
          <li key={c.id} className="canvas-row">
            {renamingId === c.id ? (
              <EditableName
                className="canvas-row-name"
                value={c.name}
                autoFocus
                onSave={(name) => rename(c.id, name)}
                onDone={() => setRenamingId(null)}
              />
            ) : (
              <Link className="canvas-row-link" to={`/canvas/${c.id}`} onDoubleClick={(e) => {
                e.preventDefault()
                setRenamingId(c.id)
              }}>
                <span className="canvas-row-name">{c.name}</span>
                <span className="muted small">Updated {formatDate(c.updated_at)}</span>
              </Link>
            )}
            <button className="btn" onClick={() => setRenamingId(c.id)}>
              Rename
            </button>
            <button className="btn btn-danger" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
