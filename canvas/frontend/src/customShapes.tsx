import {
  DefaultToolbar,
  DefaultToolbarContent,
  type Editor,
  type TLComponents,
  type TLUiOverrides,
  ToolbarItem,
} from 'tldraw'
import { LIST_TYPE, listShapeUtils, listTools, listUiOverrides, registerListSideEffects } from './list'
import { COLUMN_TYPE, ROW_TYPE, registerStackSideEffects, stackShapeUtils, stackTools, stackUiOverrides } from './stack'
import {
  registerUrlCardPasteHandler,
  URL_CARD_TYPE,
  urlCardShapeUtils,
  urlCardTools,
  urlCardUiOverrides,
} from './url-card'

export const customShapeUtils = [...urlCardShapeUtils, ...listShapeUtils, ...stackShapeUtils]
export const customTools = [...urlCardTools, ...listTools, ...stackTools]

export const customUiOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    tools = urlCardUiOverrides.tools!(editor, tools, helpers)
    tools = listUiOverrides.tools!(editor, tools, helpers)
    return stackUiOverrides.tools!(editor, tools, helpers)
  },
}

export const customComponents: TLComponents = {
  Toolbar: (props) => (
    <DefaultToolbar {...props}>
      {/* Placed first so they never get pushed into the toolbar's overflow menu. */}
      <ToolbarItem tool={URL_CARD_TYPE} />
      <ToolbarItem tool={LIST_TYPE} />
      <ToolbarItem tool={COLUMN_TYPE} />
      <ToolbarItem tool={ROW_TYPE} />
      <DefaultToolbarContent />
    </DefaultToolbar>
  ),
}

export function registerCustomShapeHandlers(editor: Editor) {
  registerUrlCardPasteHandler(editor)
  const disposeList = registerListSideEffects(editor)
  const disposeStack = registerStackSideEffects(editor)
  return () => {
    disposeList()
    disposeStack()
  }
}
