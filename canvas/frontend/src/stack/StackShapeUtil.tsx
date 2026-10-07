import {
  BaseFrameLikeShapeUtil,
  Group2d,
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  T,
  type TLResizeInfo,
  type TLShape,
  useEditor,
  useValue,
} from 'tldraw'
import { getStackLayoutChanges, STACK_PAD } from './layout'

export const COLUMN_TYPE = 'column'
export const ROW_TYPE = 'row'

export interface StackProps {
  w: number
  h: number
}

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [COLUMN_TYPE]: StackProps
    [ROW_TYPE]: StackProps
  }
}

export type ColumnShape = TLShape<typeof COLUMN_TYPE>
export type RowShape = TLShape<typeof ROW_TYPE>
export type StackShape = ColumnShape | RowShape

export const DEFAULT_COLUMN_SIZE = { w: 240, h: 320 }
export const DEFAULT_ROW_SIZE = { w: 480, h: 160 }

abstract class StackShapeUtil<S extends StackShape> extends BaseFrameLikeShapeUtil<S> {
  static override props = {
    w: T.number,
    h: T.number,
  }

  // tldraw's hit-testing assumes frame-like shapes have Group2d geometry. Like a frame, the body is
  // hollow so clicks reach children (or pass through to the canvas). The padding strips are labels,
  // which is what lets clicking or dragging the padding select and move the stack. A single
  // full-size label would be simpler, but tldraw checks labels before hollow/stroke hits, so it
  // would steal clicks from unfilled shapes and drawings inside the stack.
  override getGeometry(shape: S) {
    const { w, h } = shape.props
    const p = Math.min(STACK_PAD, w / 2, h / 2)
    return new Group2d({
      children: [
        new Rectangle2d({ width: w, height: h, isFilled: false }),
        new Rectangle2d({ width: w, height: p, isFilled: true, isLabel: true }),
        new Rectangle2d({ y: h - p, width: w, height: p, isFilled: true, isLabel: true }),
        new Rectangle2d({ width: p, height: h, isFilled: true, isLabel: true }),
        new Rectangle2d({ x: w - p, width: p, height: h, isFilled: true, isLabel: true }),
      ],
    })
  }

  override onChildrenChange(shape: S) {
    return getStackLayoutChanges(this.editor, shape)
  }

  // Otherwise tldraw scales the children along with the stack, which moves them and can reorder them.
  override canResizeChildren() {
    return false
  }

  // Children re-lay out from the size change in registerStackSideEffects.
  override onResize(shape: S, info: TLResizeInfo<S>) {
    return resizeBox(shape, info, { minWidth: STACK_PAD * 2 + 16, minHeight: STACK_PAD * 2 + 16 })
  }

  override component(shape: S) {
    return <StackComponent shape={shape} />
  }

  override getIndicatorPath(shape: S) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 6)
    return path
  }
}

export class ColumnShapeUtil extends StackShapeUtil<ColumnShape> {
  static override type = COLUMN_TYPE

  override getDefaultProps(): StackProps {
    return { ...DEFAULT_COLUMN_SIZE }
  }
}

export class RowShapeUtil extends StackShapeUtil<RowShape> {
  static override type = ROW_TYPE

  override getDefaultProps(): StackProps {
    return { ...DEFAULT_ROW_SIZE }
  }
}

function StackComponent({ shape }: { shape: StackShape }) {
  const editor = useEditor()
  const isEmpty = useValue('stack empty', () => editor.getSortedChildIdsForParent(shape.id).length === 0, [
    editor,
    shape.id,
  ])
  return (
    <HTMLContainer className="stack-shape">
      {isEmpty && <div className="stack-shape-empty">{shape.type === ROW_TYPE ? 'Row' : 'Column'}</div>}
    </HTMLContainer>
  )
}
