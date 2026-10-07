import type { Editor, TLShape, TLShapePartial } from 'tldraw'
import { getCardFitChanges, isCardShape } from '../card/CardShapeUtil'
import { LIST_TYPE, type ListShape } from './ListShapeUtil'

export const LIST_HEADER_H = 36
export const LIST_PAD = 10
export const LIST_GAP = 8
const MIN_BODY_H = 64
const EPSILON = 0.01

export function isListShape(shape: TLShape | undefined): shape is ListShape {
  return shape?.type === LIST_TYPE
}

interface Item {
  shape: TLShape
  // Offset from the shape's origin to its visual top-left, and its visual size.
  bx: number
  by: number
  h: number
  stretch: boolean
}

function measure(editor: Editor, shape: TLShape): Item {
  // Cards stretch to the list width, but their height follows their text.
  if (isCardShape(shape)) return { shape, bx: 0, by: 0, h: editor.getShapeGeometry(shape).bounds.h, stretch: true }
  const props = shape.props as { w?: unknown; h?: unknown }
  // Box shapes stretch to the list width; anything else (text, drawings, images) keeps its size.
  const stretch =
    typeof props.w === 'number' &&
    typeof props.h === 'number' &&
    !editor.getShapeUtil(shape).isAspectRatioLocked(shape)
  if (stretch) return { shape, bx: 0, by: 0, h: props.h as number, stretch }
  const b = editor.getShapeGeometry(shape).bounds
  return { shape, bx: b.x, by: b.y, h: b.h, stretch }
}

const centerY = (item: Item) => item.shape.y + item.by + item.h / 2

/**
 * Stacks a list's children vertically, stretches box-shaped children to its width, and sizes the
 * list to fit. Order comes from the children's current vertical positions, so dragging a child
 * above or below a sibling reorders it.
 *
 * While the user is dragging children (and `settle` is false), those children are left where the
 * pointer puts them and a gap opens where they would land. On drop, `settle` lays everything out.
 *
 * Only returns partials for values that actually changed: tldraw calls onChildrenChange again
 * after these updates, so returning no-op changes would loop forever.
 */
export function getListLayoutChanges(editor: Editor, list: ListShape, settle = false): TLShapePartial[] {
  const children = editor
    .getSortedChildIdsForParent(list.id)
    .map((id) => editor.getShape(id))
    .filter((s): s is TLShape => !!s)
    .map((s) => measure(editor, s))

  const dragging =
    !settle && editor.isIn('select.translating') ? new Set(editor.getSelectedShapeIds()) : new Set<string>()
  const floating = children.filter((c) => dragging.has(c.shape.id))
  const stacked = children.filter((c) => !dragging.has(c.shape.id)).sort((a, b) => centerY(a) - centerY(b))

  const floatingH = floating.reduce((sum, c) => sum + c.h, 0) + LIST_GAP * Math.max(0, floating.length - 1)
  const floatingCenter = floating.length ? floating.reduce((sum, c) => sum + centerY(c), 0) / floating.length : 0
  let gapPlaced = floating.length === 0

  const innerW = Math.max(40, list.props.w - LIST_PAD * 2)
  const changes: TLShapePartial[] = []
  let cursor = LIST_HEADER_H + LIST_PAD

  for (const item of stacked) {
    if (!gapPlaced && floatingCenter < cursor + item.h / 2) {
      cursor += floatingH + LIST_GAP
      gapPlaced = true
    }
    const x = LIST_PAD - item.bx
    const y = cursor - item.by
    const { shape } = item
    const props = isCardShape(shape)
      ? getCardFitChanges(shape, innerW)
      : item.stretch && Math.abs((shape.props as { w: number }).w - innerW) > EPSILON
        ? { w: innerW }
        : {}
    const propsChanged = Object.keys(props).length > 0
    if (Math.abs(shape.x - x) > EPSILON || Math.abs(shape.y - y) > EPSILON || propsChanged || shape.rotation !== 0) {
      changes.push({
        id: shape.id,
        type: shape.type,
        x,
        y,
        rotation: 0,
        ...(propsChanged ? { props } : {}),
        // Generic over every shape type, which TS can't narrow; `w` was checked to exist above.
      } as TLShapePartial)
    }
    cursor += item.h + LIST_GAP
  }
  if (!gapPlaced) cursor += floatingH + LIST_GAP

  const contentH = children.length ? cursor - LIST_GAP - (LIST_HEADER_H + LIST_PAD) : 0
  const h = LIST_HEADER_H + LIST_PAD * 2 + Math.max(MIN_BODY_H, contentH)
  if (Math.abs(list.props.h - h) > EPSILON) {
    changes.push({ id: list.id, type: LIST_TYPE, props: { h } })
  }
  return changes
}

export function layoutList(editor: Editor, list: ListShape, settle = false) {
  const changes = getListLayoutChanges(editor, list, settle)
  if (changes.length) editor.updateShapes(changes)
}
