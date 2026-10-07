import { createShapeId, StateNode, startEditingShapeWithRichText, toRichText } from 'tldraw'
import { CARD_PAD, CARD_TYPE, type CardShape } from './CardShapeUtil'

// tldraw's text tool hardcodes the 'text' type, so this is a simpler click-to-create version of it.
export class CardTool extends StateNode {
  static override id = CARD_TYPE

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown() {
    const { x, y } = this.editor.inputs.getCurrentPagePoint()
    const id = createShapeId()
    const scale = this.editor.getResizeScaleFactor()
    this.editor.markHistoryStoppingPoint('create card')
    this.editor.createShape<CardShape>({
      id,
      type: CARD_TYPE,
      x: x - CARD_PAD * scale,
      y: y - CARD_PAD * scale,
      props: { richText: toRichText(''), scale },
    })
    this.editor.select(id)
    startEditingShapeWithRichText(this.editor, id)
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}
