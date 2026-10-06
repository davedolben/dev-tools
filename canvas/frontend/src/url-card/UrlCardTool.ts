import { createShapeId, type Editor, StateNode, type TLShapeId } from 'tldraw'
import { defaultUrlCardSize, URL_CARD_TYPE, type UrlCardShape } from './UrlCardShapeUtil'

export function startEditingShape(editor: Editor, id: TLShapeId) {
  const shape = editor.getShape(id)
  if (!shape) return
  editor.select(id)
  editor.setEditingShape(id)
  editor.setCurrentTool('select.editing_shape', { target: 'shape', shape })
}

export class UrlCardTool extends StateNode {
  static override id = URL_CARD_TYPE

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown() {
    const { x, y } = this.editor.inputs.getCurrentPagePoint()
    const { w, h } = defaultUrlCardSize('empty')
    const id = createShapeId()
    this.editor.markHistoryStoppingPoint('create url card')
    this.editor.createShape<UrlCardShape>({ id, type: URL_CARD_TYPE, x: x - w / 2, y: y - h / 2 })
    startEditingShape(this.editor, id)
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}
