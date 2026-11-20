import { createShapeId, defaultHandleExternalTextContent, type Editor, type TLUiOverrides, type VecLike } from 'tldraw'
import { defaultUrlCardSize, postUrl, URL_CARD_TYPE, UrlCardShapeUtil, type UrlCardShape } from './UrlCardShapeUtil'
import { UrlCardTool } from './UrlCardTool'

export { URL_CARD_TYPE }

export const urlCardShapeUtils = [UrlCardShapeUtil]
export const urlCardTools = [UrlCardTool]

export const urlCardUiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools[URL_CARD_TYPE] = {
      id: URL_CARD_TYPE,
      icon: 'link',
      label: 'URL card',
      kbd: 'u',
      onSelect: () => editor.setCurrentTool(URL_CARD_TYPE),
    }
    return tools
  },
}

const STACK_GAP = 12
// tldraw dispatches a whitespace-separated URL list as one 'url' event per URL, all at the same point,
// so consecutive pastes within this window stack below each other instead of overlapping.
const STACK_WINDOW_MS = 1000

let lastPasted: { anchor: string; at: number; x: number; bottom: number } | null = null

function placeUrlCard(editor: Editor, url: string, point: VecLike | undefined) {
  const center = point ?? editor.getViewportPageBounds().center
  const anchor = `${center.x},${center.y}`
  const { w, h } = defaultUrlCardSize('link')
  const stack = lastPasted && lastPasted.anchor === anchor && Date.now() - lastPasted.at < STACK_WINDOW_MS ? lastPasted : null
  const x = stack ? stack.x : center.x - w / 2
  const y = stack ? stack.bottom + STACK_GAP : center.y - h / 2
  const id = createShapeId()
  editor.createShape<UrlCardShape>({ id, type: URL_CARD_TYPE, x, y })
  lastPasted = { anchor, at: Date.now(), x, bottom: y + h }
  void postUrl(editor, id, url)
  return id
}

// Returns the URLs if every non-empty line is a single http(s) URL, optionally prefixed by a "-" or "*" bullet.
function parseUrlList(text: string): string[] | null {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
  if (lines.length === 0) return null
  for (const line of lines) {
    try {
      const u = new URL(line)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    } catch {
      return null
    }
  }
  return lines
}

// Pasting or dropping a URL (or a list of URLs) onto the canvas creates URL cards instead of tldraw's
// default bookmark or text shape.
export function registerUrlCardPasteHandler(editor: Editor) {
  editor.registerExternalContentHandler('url', ({ url, point }) => {
    editor.markHistoryStoppingPoint('paste url card')
    editor.select(placeUrlCard(editor, url, point))
  })
  editor.registerExternalContentHandler('text', (content) => {
    const urls = parseUrlList(content.text)
    if (!urls) return defaultHandleExternalTextContent(editor, content)
    editor.markHistoryStoppingPoint('paste url cards')
    lastPasted = null
    editor.select(...urls.map((url) => placeUrlCard(editor, url, content.point)))
  })
}
