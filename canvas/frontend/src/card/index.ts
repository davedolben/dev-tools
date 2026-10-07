import type { Editor, TLUiOverrides } from 'tldraw'
import { isListShape } from '../list/layout'
import { isStackShape } from '../stack/layout'
import { CARD_TYPE, type CardShape, CardShapeUtil, isCardShape } from './CardShapeUtil'
import { CardTool } from './CardTool'

export { CARD_TYPE }

export const cardShapeUtils = [CardShapeUtil]
export const cardTools = [CardTool]

export const cardUiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools[CARD_TYPE] = {
      id: CARD_TYPE,
      icon: 'geo-rectangle',
      label: 'Card',
      onSelect: () => editor.setCurrentTool(CARD_TYPE),
    }
    return tools
  },
}

// Lists, rows, and columns size the cards inside them. Once a card is dragged out of one, it goes
// back to fitting its text.
export function registerCardSideEffects(editor: Editor) {
  return editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
    if (!isCardShape(next) || prev.parentId === next.parentId) return
    const parent = editor.getShape(next.parentId)
    if (isListShape(parent) || isStackShape(parent)) return
    if (next.props.autoSize) return
    editor.updateShape<CardShape>({ id: next.id, type: CARD_TYPE, props: { autoSize: true } })
  })
}
