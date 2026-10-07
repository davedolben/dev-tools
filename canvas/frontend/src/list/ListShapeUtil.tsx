import { useState } from 'react'
import {
  BaseFrameLikeShapeUtil,
  Group2d,
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  stopEventPropagation,
  T,
  type TLResizeInfo,
  type TLShape,
  useEditor,
  useIsEditing,
  useValue,
} from 'tldraw'
import { getListLayoutChanges, LIST_HEADER_H, layoutList } from './layout'

export const LIST_TYPE = 'list'

export interface ListProps {
  w: number
  h: number
  title: string
}

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [LIST_TYPE]: ListProps
  }
}

export type ListShape = TLShape<typeof LIST_TYPE>

export const DEFAULT_LIST_W = 360

export class ListShapeUtil extends BaseFrameLikeShapeUtil<ListShape> {
  static override type = LIST_TYPE
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
  }

  override getDefaultProps(): ListProps {
    return { w: DEFAULT_LIST_W, h: 120, title: 'List' }
  }

  override canEdit() {
    return true
  }

  // tldraw's hit-testing assumes frame-like shapes have Group2d geometry. As with frames, the body is
  // hollow (clicks pass through to children or the canvas) and the header acts as the label, so
  // clicking or dragging the header selects and moves the list.
  override getGeometry(shape: ListShape) {
    return new Group2d({
      children: [
        new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false }),
        new Rectangle2d({ width: shape.props.w, height: LIST_HEADER_H, isFilled: true, isLabel: true }),
      ],
    })
  }

  override onChildrenChange(shape: ListShape) {
    return getListLayoutChanges(this.editor, shape)
  }

  // Otherwise tldraw scales the children along with the list, which moves them and can reorder them.
  // The layout restretches them to the new width anyway.
  override canResizeChildren() {
    return false
  }

  override onResize(shape: ListShape, info: TLResizeInfo<ListShape>) {
    // Height always comes from the children, so only the width is really resizable.
    const resized = resizeBox(shape, info, { minWidth: 200 })
    return { ...resized, y: shape.y, props: { ...resized.props, h: shape.props.h } }
  }

  override onResizeEnd(_initial: ListShape, current: ListShape) {
    layoutList(this.editor, current, true)
  }

  override component(shape: ListShape) {
    return <ListComponent shape={shape} />
  }

  override getIndicatorPath(shape: ListShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}

function ListComponent({ shape }: { shape: ListShape }) {
  const isEditing = useIsEditing(shape.id)
  const editor = useEditor()
  const isEmpty = useValue('list empty', () => editor.getSortedChildIdsForParent(shape.id).length === 0, [
    editor,
    shape.id,
  ])
  return (
    <HTMLContainer className="list-shape">
      <div className="list-shape-header" style={{ height: LIST_HEADER_H }}>
        {isEditing ? <TitleInput shape={shape} /> : <span className="list-shape-title">{shape.props.title || 'Untitled list'}</span>}
      </div>
      {isEmpty && <div className="list-shape-empty">Drag widgets here</div>}
    </HTMLContainer>
  )
}

function TitleInput({ shape }: { shape: ListShape }) {
  const editor = useEditor()
  const [original] = useState(shape.props.title)

  // The title saves as you type (like tldraw's own text shapes), so leaving edit mode any
  // way — Enter, clicking away — keeps it. Escape restores the original.
  const setTitle = (title: string) => editor.updateShape<ListShape>({ id: shape.id, type: LIST_TYPE, props: { title } })

  const finish = () => {
    if (!shape.props.title.trim()) setTitle(original)
    editor.setEditingShape(null)
    editor.setCurrentTool('select.idle')
  }

  return (
    <input
      className="list-shape-title-input"
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      value={shape.props.title}
      onChange={(e) => setTitle(e.target.value)}
      onPointerDown={stopEventPropagation}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') setTitle(original)
        if (e.key === 'Enter' || e.key === 'Escape') finish()
      }}
    />
  )
}
