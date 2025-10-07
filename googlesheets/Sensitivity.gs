/**
 * Runs a scenario table with N inputs and M outputs.
 *
 * Named ranges:
 *   - ScenarioTable: rows of scenarios; first N columns = inputs; last M columns = outputs to fill
 *   - InputCells: contiguous 1×N or N×1 range for the model inputs (order matches first N columns)
 *   - OutputCells: contiguous 1×M or M×1 range for the model outputs to read per scenario
 *
 * Options:
 *   hasHeader: true to skip the first row
 *   skipBlankRows: true to skip rows where all N input cells are blank
 */
function runScenarioTable(options) {
  const cfg = Object.assign({
    tableName: 'ScenarioTable',
    inputCellsName: 'InputCells',
    outputCellsName: 'OutputCells',
    hasHeader: false,
    skipBlankRows: true
  }, options || {});

  const ss = SpreadsheetApp.getActive();
  const tableRange = ss.getRangeByName(cfg.tableName);
  const inputCellsRange = ss.getRangeByName(cfg.inputCellsName);
  const outputCellsRange = ss.getRangeByName(cfg.outputCellsName);

  if (!tableRange || !inputCellsRange || !outputCellsRange) {
    throw new Error('Missing one or more named ranges (ScenarioTable, InputCells, OutputCells).');
  }

  // Flatten a contiguous range to an ordered list of single cells (row-major)
  function cellsList(rng) {
    const list = [];
    for (let r = 1; r <= rng.getNumRows(); r++) {
      for (let c = 1; c <= rng.getNumColumns(); c++) {
        list.push(rng.getCell(r, c));
      }
    }
    return list;
  }

  const inputCells = cellsList(inputCellsRange);
  const outputCells = cellsList(outputCellsRange);

  const N = inputCells.length;
  const M = outputCells.length;
  if (N < 1) throw new Error('InputCells must contain at least one cell.');
  if (M < 1) throw new Error('OutputCells must contain at least one cell.');

  // Snapshot original inputs (preserve formulas if present)
  const origInputs = inputCells.map(cell => {
    const f = cell.getFormula();
    return { cell, formula: f, value: f ? null : cell.getValue() };
  });

  // Read the entire scenario table
  const tableVals = tableRange.getValues();
  const totalRows = tableVals.length;
  const totalCols = tableVals[0].length;

  // Validate table width: need at least N input cols + M output cols
  if (totalCols < N + M) {
    throw new Error(`ScenarioTable must have at least N (${N}) input columns plus M (${M}) result columns (total ≥ ${N + M}).`);
  }

  // Column positions (0-based)
  const inputsStartCol = 0;
  const outputsStartCol = totalCols - M;

  const startRow = cfg.hasHeader ? 1 : 0;
  let rowsProcessed = 0;

  for (let r = startRow; r < totalRows; r++) {
    const row = tableVals[r];

    // Take the first N cells as scenario inputs
    const scenarioInputs = row.slice(inputsStartCol, inputsStartCol + N);

    if (cfg.skipBlankRows && scenarioInputs.every(v => v === '' || v === null)) {
      continue;
    }

    // Apply N inputs to model
    for (let i = 0; i < N; i++) {
      inputCells[i].setValue(scenarioInputs[i]);
    }

    SpreadsheetApp.flush(); // force calc

    // Read M outputs (same order as OutputCells range)
    const outputs = outputCells.map(c => c.getValue());

    // Place M outputs into the last M columns of this row
    for (let j = 0; j < M; j++) {
      row[outputsStartCol + j] = outputs[j];
    }

    rowsProcessed++;
  }

  // Write updated table back in one go
  tableRange.setValues(tableVals);

  // Restore original inputs (formula > value)
  origInputs.forEach(({ cell, formula, value }) => {
    if (formula) cell.setFormula(formula);
    else cell.setValue(value);
  });
  SpreadsheetApp.flush();

  Logger.log(`Processed ${rowsProcessed} scenario row(s), wrote ${M} output column(s).`);
}
