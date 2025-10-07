/**
 * Colors numeric cells on the active sheet:
 * - Formula-derived numbers -> COLOR_FORMULA
 * - Manually entered numbers -> COLOR_INPUT
 *
 * Note: Arrayformula spill cells (the non-anchor cells of an array formula)
 * are reported by Apps Script as having no formula; those will be treated
 * as direct inputs due to Sheets API limitations.
 *
 * @param {boolean} clearColors - If true, clears background colors for all numeric cells
 */
function colorNumericCellsByOrigin(clearColors = false) {
  const COLOR_FORMULA = '#e6e6e6'; // light grey
  const COLOR_INPUT   = '#cff6ff'; // light blue
  const onlyColorInputs = true;

  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();        // 2D array of values
  const formulas = range.getFormulas();    // 2D array of formula strings ('' if none)
  const backgrounds = range.getBackgrounds(); // start from existing colors

  const numRows = values.length;
  if (numRows === 0) return;
  const numCols = values[0].length;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const v = values[r][c];

      // Only act on numeric values (Dates come through as Date objects, so skip those)
      const isNumber = typeof v === 'number' && !isNaN(v);
      const isDate = v instanceof Date;
      if (!isNumber || isDate) continue;

      if (clearColors) {
        backgrounds[r][c] = null; // Clear the background color
      } else {
        const hasFormula = formulas[r][c] !== '';
        if (onlyColorInputs && hasFormula) {
          continue;
        }
        backgrounds[r][c] = hasFormula ? COLOR_FORMULA : COLOR_INPUT;
      }
    }
  }

  range.setBackgrounds(backgrounds);
}

/**
 * Wrapper function to clear colors for numeric cells (for menu item).
 */
function clearNumericCellColors() {
  colorNumericCellsByOrigin(true);
}

/**
 * Optional: add a menu to run the formatter from the sheet UI.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Format helpers')
    .addItem('Color numeric cells by origin', 'colorNumericCellsByOrigin')
    .addItem('Clear numeric cell colors', 'clearNumericCellColors')
    .addToUi();
}

