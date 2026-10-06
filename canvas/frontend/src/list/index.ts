import { type Editor, react, type TLUiOverrides } from 'tldraw'
import { isListShape, layoutList } from './layout'
import { LIST_TYPE, ListShapeUtil } from './ListShapeUtil'
import { ListTool } from './ListTool'

export { LIST_TYPE }

export const listShapeUtils = [ListShapeUtil]
export const listTools = [ListTool]

export const listUiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools[LIST_TYPE] = {
      id: LIST_TYPE,
      icon: 'stack-vertical',
      label: 'List',
      kbd: 's',
      onSelect: () => editor.setCurrentTool(LIST_TYPE),
    }
    return tools
  },
}

export function registerListSideEffects(editor: Editor) {
  // tldraw only calls onChildrenChange when an existing child changes, not when a shape is created
  // straight into a list (e.g. using a tool on top of it, pasting, or duplicating a child).
  const disposeCreate = editor.sideEffects.registerAfterCreateHandler('shape', (shape) => {
    const parent = editor.getShape(shape.parentId)
    if (isListShape(parent)) layoutList(editor, parent, true)
  })

  // Children being dragged float freely, so snap them into place once the drag ends. This can't
  // rely on onDropShapesOver: tldraw skips it when the shape was already a child of the list,
  // which is exactly the reorder case.
  let wasTranslating = false
  const disposeReact = react('settle lists after drag', () => {
    const translating = editor.isIn('select.translating')
    if (wasTranslating && !translating) {
      // Deferred so the layout's reads don't become dependencies of this reaction.
      queueMicrotask(() => {
        for (const shape of editor.getCurrentPageShapes()) {
          if (isListShape(shape)) layoutList(editor, shape, true)
        }
      })
    }
    wasTranslating = translating
  })

  return () => {
    disposeCreate()
    disposeReact()
  }
}
