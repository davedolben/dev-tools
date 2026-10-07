import { createShapeId, StateNode } from 'tldraw'
import {
  COLUMN_TYPE,
  DEFAULT_COLUMN_SIZE,
  DEFAULT_ROW_SIZE,
  ROW_TYPE,
  type StackProps,
  type StackShape,
} from './StackShapeUtil'

abstract class StackTool extends StateNode {
  abstract shapeType: StackShape['type']
  abstract defaultSize: StackProps

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown() {
    const { x, y } = this.editor.inputs.getCurrentPagePoint()
    const { w, h } = this.defaultSize
    const id = createShapeId()
    this.editor.markHistoryStoppingPoint(`create ${this.shapeType}`)
    this.editor.createShape<StackShape>({ id, type: this.shapeType, x: x - w / 2, y: y - h / 2 })
    this.editor.select(id)
    this.editor.setCurrentTool('select')
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}

export class ColumnTool extends StackTool {
  static override id = COLUMN_TYPE
  readonly shapeType = COLUMN_TYPE
  defaultSize = DEFAULT_COLUMN_SIZE
}

export class RowTool extends StackTool {
  static override id = ROW_TYPE
  readonly shapeType = ROW_TYPE
  defaultSize = DEFAULT_ROW_SIZE
}
