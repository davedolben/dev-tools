import type { Editor, TLShape, TLShapePartial } from 'tldraw'
import { getCardFitChanges, isCardShape } from '../card/CardShapeUtil'
import { isListShape } from '../list/layout'
import { COLUMN_TYPE, ROW_TYPE, type StackShape } from './StackShapeUtil'

export const STACK_PAD = 16
export const STACK_GAP = 8
const MIN_SHARE = 16
const EPSILON = 0.01

export function isStackShape(shape: TLShape | undefined): shape is StackShape {
  return shape?.type === COLUMN_TYPE || shape?.type === ROW_TYPE
}

interface Item {
  shape: TLShape
  // Offset from the shape's origin to its visual top-left, and its visual size.
  bx: number
  by: number
  w: number
  h: number
  stretchW: boolean
  stretchH: boolean
}

function measure(editor: Editor, shape: TLShape): Item {
  // Like a list, a card's height follows its contents, so only its width can be stretched.
  if (isCardShape(shape)) {
    const b = editor.getShapeGeometry(shape).bounds
    return { shape, bx: 0, by: 0, w: b.w, h: b.h, stretchW: true, stretchH: false }
  }
  const props = shape.props as { w?: unknown; h?: unknown }
  // Box shapes fill their slot; anything else (text, drawings, images) keeps its size.
  const isBox =
    typeof props.w === 'number' &&
    typeof props.h === 'number' &&
    !editor.getShapeUtil(shape).isAspectRatioLocked(shape)
  if (isBox) {
    // A list's height always follows its contents, so only its width can be stretched.
    return { shape, bx: 0, by: 0, w: props.w as number, h: props.h as number, stretchW: true, stretchH: !isListShape(shape) }
  }
  const b = editor.getShapeGeometry(shape).bounds
  return { shape, bx: b.x, by: b.y, w: b.w, h: b.h, stretchW: false, stretchH: false }
}

/**
 * Lays out a column's or row's children like CSS flexbox with `flex: 1` and `align-items: stretch`:
 * along the main axis, fixed-size children keep their size and box-shaped children split the
 * remaining space evenly; across it, box-shaped children fill the container. The container's own
 * size is never changed. Order comes from the children's current positions along the main axis.
 *
 * Dragging behaves like the list: while children are being dragged (and `settle` is false) they
 * float where the pointer puts them and their slot opens where they would land.
 *
 * Only returns partials for values that actually changed: tldraw calls onChildrenChange again
 * after these updates, so returning no-op changes would loop forever.
 */
export function getStackLayoutChanges(editor: Editor, stack: StackShape, settle = false): TLShapePartial[] {
  const isRow = stack.type === ROW_TYPE
  const main = isRow
    ? { pos: 'x', size: 'w', offset: 'bx', stretch: 'stretchW' } as const
    : { pos: 'y', size: 'h', offset: 'by', stretch: 'stretchH' } as const
  const cross = isRow
    ? { pos: 'y', size: 'h', offset: 'by', stretch: 'stretchH' } as const
    : { pos: 'x', size: 'w', offset: 'bx', stretch: 'stretchW' } as const

  const children = editor
    .getSortedChildIdsForParent(stack.id)
    .map((id) => editor.getShape(id))
    .filter((s): s is TLShape => !!s)
    .map((s) => measure(editor, s))
  if (!children.length) return []

  const innerMain = stack.props[main.size] - STACK_PAD * 2
  const innerCross = Math.max(0, stack.props[cross.size] - STACK_PAD * 2)

  // Every child, floating or not, keeps a slot, so siblings don't jump around mid-drag.
  const fixedTotal = children.reduce((sum, c) => sum + (c[main.stretch] ? 0 : c[main.size]), 0)
  const flexCount = children.filter((c) => c[main.stretch]).length
  const share = flexCount
    ? Math.max(MIN_SHARE, (innerMain - fixedTotal - STACK_GAP * (children.length - 1)) / flexCount)
    : 0
  const mainSize = (c: Item) => (c[main.stretch] ? share : c[main.size])
  const center = (c: Item) => c.shape[main.pos] + c[main.offset] + c[main.size] / 2

  const dragging =
    !settle && editor.isIn('select.translating') ? new Set(editor.getSelectedShapeIds()) : new Set<string>()
  const floating = children.filter((c) => dragging.has(c.shape.id))
  const stacked = children.filter((c) => !dragging.has(c.shape.id)).sort((a, b) => center(a) - center(b))

  const floatingSize =
    floating.reduce((sum, c) => sum + mainSize(c), 0) + STACK_GAP * Math.max(0, floating.length - 1)
  const floatingCenter = floating.length ? floating.reduce((sum, c) => sum + center(c), 0) / floating.length : 0
  let gapPlaced = floating.length === 0

  const changes: TLShapePartial[] = []
  let cursor = STACK_PAD

  for (const item of stacked) {
    const size = mainSize(item)
    if (!gapPlaced && floatingCenter < cursor + size / 2) {
      cursor += floatingSize + STACK_GAP
      gapPlaced = true
    }
    const { shape } = item
    const pos = { [main.pos]: cursor - item[main.offset], [cross.pos]: STACK_PAD - item[cross.offset] }
    let props: Record<string, number | boolean> = {}
    if (isCardShape(shape)) {
      props = getCardFitChanges(shape, isRow ? size : innerCross)
    } else {
      if (item[main.stretch] && Math.abs(item[main.size] - size) > EPSILON) props[main.size] = size
      if (item[cross.stretch] && Math.abs(item[cross.size] - innerCross) > EPSILON) props[cross.size] = innerCross
    }

    if (
      Math.abs(shape.x - pos.x) > EPSILON ||
      Math.abs(shape.y - pos.y) > EPSILON ||
      Object.keys(props).length ||
      shape.rotation !== 0
    ) {
      changes.push({
        id: shape.id,
        type: shape.type,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        ...(Object.keys(props).length ? { props } : {}),
        // Generic over every shape type, which TS can't narrow; `w`/`h` were checked to exist above.
      } as TLShapePartial)
    }
    cursor += size + STACK_GAP
  }
  return changes
}

export function layoutStack(editor: Editor, stack: StackShape, settle = false) {
  const changes = getStackLayoutChanges(editor, stack, settle)
  if (changes.length) editor.updateShapes(changes)
}
