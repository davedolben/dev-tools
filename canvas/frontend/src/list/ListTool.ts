import { createShapeId, StateNode } from 'tldraw'
import { startEditingShape } from '../url-card/UrlCardTool'
import { DEFAULT_LIST_W, LIST_TYPE, type ListShape } from './ListShapeUtil'

export class ListTool extends StateNode {
  static override id = LIST_TYPE

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown() {
    const { x, y } = this.editor.inputs.getCurrentPagePoint()
    const id = createShapeId()
    this.editor.markHistoryStoppingPoint('create list')
    this.editor.createShape<ListShape>({ id, type: LIST_TYPE, x: x - DEFAULT_LIST_W / 2, y })
    startEditingShape(this.editor, id)
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}
