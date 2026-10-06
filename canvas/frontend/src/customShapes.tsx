import {
  DefaultToolbar,
  DefaultToolbarContent,
  type Editor,
  type TLComponents,
  type TLUiOverrides,
  ToolbarItem,
} from 'tldraw'
import { LIST_TYPE, listShapeUtils, listTools, listUiOverrides, registerListSideEffects } from './list'
import {
  registerUrlCardPasteHandler,
  URL_CARD_TYPE,
  urlCardShapeUtils,
  urlCardTools,
  urlCardUiOverrides,
} from './url-card'

export const customShapeUtils = [...urlCardShapeUtils, ...listShapeUtils]
export const customTools = [...urlCardTools, ...listTools]

export const customUiOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    tools = urlCardUiOverrides.tools!(editor, tools, helpers)
    return listUiOverrides.tools!(editor, tools, helpers)
  },
}

export const customComponents: TLComponents = {
  Toolbar: (props) => (
    <DefaultToolbar {...props}>
      {/* Placed first so they never get pushed into the toolbar's overflow menu. */}
      <ToolbarItem tool={URL_CARD_TYPE} />
      <ToolbarItem tool={LIST_TYPE} />
      <DefaultToolbarContent />
    </DefaultToolbar>
  ),
}

export function registerCustomShapeHandlers(editor: Editor) {
  registerUrlCardPasteHandler(editor)
  return registerListSideEffects(editor)
}
