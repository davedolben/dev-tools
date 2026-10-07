import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  type Editor,
  Rectangle2d,
  type TLResizeInfo,
  type TLShape,
  type TLTextShape,
  type TLTextShapeProps,
  TextShapeUtil,
  Vec,
} from 'tldraw'

export const CARD_TYPE = 'card'
export const CARD_PAD = 12
const EPSILON = 0.01

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [CARD_TYPE]: TLTextShapeProps
  }
}

export type CardShape = TLShape<typeof CARD_TYPE>

export function isCardShape(shape: TLShape | undefined): shape is CardShape {
  return shape?.type === CARD_TYPE
}

/**
 * The prop changes that make a card's outer width `outerW`; its height always fits the text. Only
 * returns props that actually change, since layouts must not return no-op updates.
 */
export function getCardFitChanges(card: CardShape, outerW: number) {
  const w = outerW / card.props.scale - CARD_PAD * 2
  const changes: Partial<Pick<CardShape['props'], 'autoSize' | 'w'>> = {}
  if (card.props.autoSize) changes.autoSize = false
  if (Math.abs(card.props.w - w) > EPSILON) changes.w = w
  return changes
}

const migrationIds = createShapePropsMigrationIds(CARD_TYPE, { AddFillH: 1, RemoveFillH: 2 })

/**
 * A text shape with a border and padding. It reuses everything from tldraw's text shape (editing,
 * auto-sizing, styles) and only adds the padding around the text: `w` and the measured text size
 * stay the text's own size, and the geometry adds CARD_PAD on every side.
 *
 * TextShapeUtil is typed for 'text' shapes only, so card shapes are passed through as
 * TLTextShape. They have identical props, so this is safe at runtime.
 */
// @ts-expect-error TextShapeUtil narrows the static `type` to 'text'.
export class CardShapeUtil extends TextShapeUtil {
  static override type = CARD_TYPE
  // The text shape's migrations are tied to the 'text' type's sequence id, which tldraw rejects for
  // any other type, so the card has a sequence of its own.
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: migrationIds.AddFillH,
        up: (props) => {
          props.fillH = 0
        },
        down: (props) => {
          delete props.fillH
        },
      },
      // Cards briefly had a `fillH` prop for filling a row or column's height. Saved cards may
      // still have it.
      {
        id: migrationIds.RemoveFillH,
        up: (props) => {
          delete props.fillH
        },
        down: (props) => {
          props.fillH = 0
        },
      },
    ],
  })

  // The outline is drawn in the canvas background color, which shows up as a halo on the card.
  constructor(editor: Editor) {
    super(editor)
    this.options = { ...this.options, showTextOutline: false }
  }

  override getGeometry(shape: TLTextShape) {
    const { scale } = shape.props
    const { width, height } = this.getMinDimensions(shape)
    return new Rectangle2d({
      width: (width + CARD_PAD * 2) * scale,
      height: (height + CARD_PAD * 2) * scale,
      isFilled: true,
      isLabel: true,
    })
  }

  override component(shape: TLTextShape) {
    const { scale } = shape.props
    const { width, height } = this.getMinDimensions(shape)
    return (
      <div className="card-shape" style={{ borderRadius: 8 * scale }}>
        <div
          style={{
            position: 'absolute',
            left: CARD_PAD * scale,
            top: CARD_PAD * scale,
            width: width * scale,
            height: height * scale,
          }}
        >
          {super.component(shape)}
        </div>
      </div>
    )
  }

  override getIndicatorPath(shape: TLTextShape) {
    const { width, height } = this.editor.getShapeGeometry(shape).bounds
    const path = new Path2D()
    path.roundRect(0, 0, width, height, 8 * shape.props.scale)
    return path
  }

  // Width-only resizes set `w` from the new outer width, which includes the padding.
  override onResize(shape: TLTextShape, info: TLResizeInfo<TLTextShape>) {
    const result = super.onResize(shape, info)
    if (result.props && 'w' in result.props) {
      result.props.w = Math.max(1, result.props.w - CARD_PAD * 2)
      // tldraw only unlocks the aspect ratio for side-handle drags on 'text' shapes, so for cards it
      // also scales the height around the vertical center and newPoint drifts up or down. The height
      // comes from the text anyway, so pin the top edge and only move along the shape's x axis.
      const outerW = (result.props.w + CARD_PAD * 2) * info.initialShape.props.scale
      const shift = info.handle === 'left' ? info.initialBounds.width - outerW : 0
      const { x, y } = Vec.FromAngle(shape.rotation).mul(shift).add(info.initialShape)
      result.x = x
      result.y = y
    }
    return result
  }
}
