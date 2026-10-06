import { createShapeId, type Editor, type TLUiOverrides } from 'tldraw'
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

// Pasting or dropping a URL onto the canvas creates a URL card instead of tldraw's default bookmark.
export function registerUrlCardPasteHandler(editor: Editor) {
  editor.registerExternalContentHandler('url', ({ url, point }) => {
    const center = point ?? editor.getViewportPageBounds().center
    const { w, h } = defaultUrlCardSize('link')
    const id = createShapeId()
    editor.markHistoryStoppingPoint('paste url card')
    editor.createShape<UrlCardShape>({ id, type: URL_CARD_TYPE, x: center.x - w / 2, y: center.y - h / 2 })
    editor.select(id)
    void postUrl(editor, id, url)
  })
}
