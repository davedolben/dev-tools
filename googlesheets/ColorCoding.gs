/**
 * Colors numeric cells on the active sheet:
 * - Formula-derived numbers -> COLOR_FORMULA
 * - Manually entered numbers -> COLOR_INPUT
 *
 * Note: Arrayformula spill cells (the non-anchor cells of an array formula)
 * are reported by Apps Script as having no formula; those will be treated
 * as direct inputs due to Sheets API limitations.
 *
 * @param {string} mode - 'inputs' to highlight only input cells, 'formulas' to highlight only formula cells, 'clear' to clear colors
 */
function colorNumericCellsByOrigin(mode = 'inputs') {
  const COLOR_FORMULA = '#e6e6e6'; // light grey
  const COLOR_INPUT   = '#cff6ff'; // light blue

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

      const hasFormula = formulas[r][c] !== '';

      if (mode === 'clear') {
        backgrounds[r][c] = null; // Clear the background color
      } else if (mode === 'inputs') {
        if (!hasFormula) {
          backgrounds[r][c] = COLOR_INPUT;
        }
      } else if (mode === 'formulas') {
        if (hasFormula) {
          backgrounds[r][c] = COLOR_FORMULA;
        }
      }
    }
  }

  range.setBackgrounds(backgrounds);
}

/**
 * Wrapper function to highlight input cells (for menu item).
 */
function highlightInputCells() {
  colorNumericCellsByOrigin('inputs');
}

/**
 * Wrapper function to highlight formula cells (for menu item).
 */
function highlightFormulaCells() {
  colorNumericCellsByOrigin('formulas');
}

/**
 * Wrapper function to clear colors for numeric cells (for menu item).
 */
function clearNumericCellColors() {
  colorNumericCellsByOrigin('clear');
}

/**
 * Optional: add a menu to run the formatter from the sheet UI.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Format helpers')
    .addItem('Highlight input cells', 'highlightInputCells')
    .addItem('Highlight formula cells', 'highlightFormulaCells')
    .addItem('Clear numeric cell colors', 'clearNumericCellColors')
    .addToUi();
}

