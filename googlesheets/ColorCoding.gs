/**
 * Helper function to convert column number to letter (1 -> A, 27 -> AA, etc.)
 */
function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
 * Colors numeric cells on the active sheet:
 * - Formula-derived numbers -> COLOR_FORMULA
 * - Manually entered numbers -> COLOR_INPUT
 *
 * Note: Arrayformula spill cells (the non-anchor cells of an array formula)
 * are reported by Apps Script as having no formula; those will be treated
 * as direct inputs due to Sheets API limitations.
 *
 * @param {string} mode - 'inputs' to highlight only input cells, 'formulas' to highlight only formula cells, 'unreferenced' to highlight cells not referenced by formulas, 'clear' to clear colors
 */
function colorNumericCellsByOrigin(mode = 'inputs') {
  const COLOR_FORMULA = '#e6e6e6'; // light grey
  const COLOR_INPUT   = '#cff6ff'; // light blue
  const COLOR_UNREFERENCED = '#ffffcc'; // light yellow

  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();        // 2D array of values
  const formulas = range.getFormulas();    // 2D array of formula strings ('' if none)
  const backgrounds = range.getBackgrounds(); // start from existing colors

  const numRows = values.length;
  if (numRows === 0) return;
  const numCols = values[0].length;

  // Build set of referenced cells if in unreferenced mode
  let referencedCells = new Set();
  if (mode === 'unreferenced') {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = spreadsheet.getSheets();
    const activeSheetName = sheet.getName();

    // Pattern for cross-sheet references: 'SheetName'!A1 or SheetName!A1
    // Quoted names can contain spaces, unquoted names cannot
    const crossSheetPattern = /(?:(['"])(.+?)\1|([A-Za-z0-9_]+))!(\$?[A-Z]+\$?\d+)/g;

    // Scan formulas from all sheets in the spreadsheet
    allSheets.forEach(currentSheet => {
      const sheetFormulas = currentSheet.getDataRange().getFormulas();
      const isActiveSheet = currentSheet.getName() === activeSheetName;

      for (let r = 0; r < sheetFormulas.length; r++) {
        for (let c = 0; c < sheetFormulas[r].length; c++) {
          const formula = sheetFormulas[r][c];
          if (!formula) continue;

          // Extract same-sheet references (A1, $A$1, A$1, $A1 notation)
          if (isActiveSheet) {
            // Remove all cross-sheet references first to avoid false matches
            const formulaWithoutCrossSheet = formula.replace(crossSheetPattern, '');
            // Now extract same-sheet references
            const cellRefPattern = /\$?[A-Z]+\$?\d+/g;
            const matches = formulaWithoutCrossSheet.match(cellRefPattern);
            if (matches) {
              matches.forEach(ref => {
                // Remove $ signs for comparison
                const cleanRef = ref.replace(/\$/g, '');
                referencedCells.add(cleanRef);
              });
            }
          }

          // Extract cross-sheet references
          let match;
          while ((match = crossSheetPattern.exec(formula)) !== null) {
            const refSheetName = match[2] || match[3]; // match[2] if quoted, match[3] if unquoted
            const cellRef = match[4];

            // Only add if it references the active sheet
            if (refSheetName === activeSheetName) {
              const cleanRef = cellRef.replace(/\$/g, '');
              referencedCells.add(cleanRef);
            }
          }
        }
      }
    });
  }

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
      } else if (mode === 'unreferenced') {
        // Convert row/col to A1 notation
        const cellA1 = columnToLetter(c + 1) + (r + 1);
        if (!referencedCells.has(cellA1)) {
          backgrounds[r][c] = COLOR_UNREFERENCED;
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
 * Wrapper function to highlight unreferenced cells (for menu item).
 */
function highlightUnreferencedCells() {
  colorNumericCellsByOrigin('unreferenced');
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
    .addItem('Highlight unreferenced cells', 'highlightUnreferencedCells')
    .addItem('Clear numeric cell colors', 'clearNumericCellColors')
    .addToUi();
}

