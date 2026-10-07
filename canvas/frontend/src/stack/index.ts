import { type Editor, react, type TLUiOverrides } from 'tldraw'
import { isListShape, layoutList } from '../list/layout'
import { isStackShape, layoutStack } from './layout'
import { COLUMN_TYPE, ColumnShapeUtil, ROW_TYPE, RowShapeUtil } from './StackShapeUtil'
import { ColumnTool, RowTool } from './StackTool'

export { COLUMN_TYPE, ROW_TYPE }

export const stackShapeUtils = [ColumnShapeUtil, RowShapeUtil]
export const stackTools = [ColumnTool, RowTool]

export const stackUiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools[COLUMN_TYPE] = {
      id: COLUMN_TYPE,
      icon: 'distribute-vertical',
      label: 'Column',
      onSelect: () => editor.setCurrentTool(COLUMN_TYPE),
    }
    tools[ROW_TYPE] = {
      id: ROW_TYPE,
      icon: 'distribute-horizontal',
      label: 'Row',
      onSelect: () => editor.setCurrentTool(ROW_TYPE),
    }
    return tools
  },
}

export function registerStackSideEffects(editor: Editor) {
  // Same reasoning as registerListSideEffects: onChildrenChange doesn't fire for shapes created
  // straight into a stack.
  const disposeCreate = editor.sideEffects.registerAfterCreateHandler('shape', (shape) => {
    const parent = editor.getShape(shape.parentId)
    if (isStackShape(parent)) layoutStack(editor, parent, true)
  })

  // onChildrenChange doesn't fire when the container itself is resized, whether by the user or by
  // a parent stack stretching it, so lay out its children again. Lists are included so a list
  // inside a stack follows the width the stack gives it.
  const disposeChange = editor.sideEffects.registerAfterChangeHandler('shape', (prev, next) => {
    if (isStackShape(next) && isStackShape(prev)) {
      if (prev.props.w !== next.props.w || prev.props.h !== next.props.h) layoutStack(editor, next)
    } else if (isListShape(next) && isListShape(prev)) {
      if (prev.props.w !== next.props.w) layoutList(editor, next)
    }
  })

  // See registerListSideEffects.
  let wasTranslating = false
  const disposeReact = react('settle stacks after drag', () => {
    const translating = editor.isIn('select.translating')
    if (wasTranslating && !translating) {
      queueMicrotask(() => {
        for (const shape of editor.getCurrentPageShapes()) {
          if (isStackShape(shape)) layoutStack(editor, shape, true)
        }
      })
    }
    wasTranslating = translating
  })

  return () => {
    disposeCreate()
    disposeChange()
    disposeReact()
  }
}
