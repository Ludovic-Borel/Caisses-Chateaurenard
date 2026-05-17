import ExcelJS from "exceljs";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth } from "./types";

/**
 * Detect driver names from row 1 of the Recap sheet.
 * Returns an array of {name, startCol} for each driver found, in order.
 * @internal exported for testing
 */
export function detectDrivers(ws: ExcelJS.Worksheet): { name: string; startCol: number }[] {
  const drivers: { name: string; startCol: number }[] = [];
  const row1 = ws.getRow(1);
  let lastName = "";

  for (let c = 1; c <= row1.cellCount; c++) {
    const val = row1.getCell(c).value;
    if (val != null) {
      const name = String(val).trim();
      // Only add if the name is non-empty, not "Jour", and different from the previous cell
      // (this handles merged cells where every cell returns the same value)
      if (name && name !== "Jour" && name !== lastName) {
        drivers.push({ name, startCol: c });
        lastName = name;
      }
    }
  }

  return drivers.sort((a, b) => a.startCol - b.startCol);
}

/**
 * Determine the column range for each driver.
 * Between a driver's startCol and the next driver's startCol (or end of sheet).
 * Within that block, assign columns in pairs: each category gets 2 columns (Esp., CB),
 * in the standard order: 704, 705, 707, 708, 915, Scolaires.
 * The remaining columns after 12 data columns are totals (we skip those).
 * @internal exported for testing
 */
export function getDriverDataColumns(
  ws: ExcelJS.Worksheet,
  drivers: { name: string; startCol: number }[]
): Map<string, { espCol: number; cbCol: number }[]> {
  const result = new Map<string, { espCol: number; cbCol: number }[]>();
  // Use the row 1 cell count as a reliable measure of actual column width
  const totalCols = Math.max(ws.columnCount, ws.getRow(1).cellCount, ws.getRow(2).cellCount);

  for (let i = 0; i < drivers.length; i++) {
    const driver = drivers[i];
    const nextStart = i + 1 < drivers.length ? drivers[i + 1].startCol : totalCols + 1;
    const blockEnd = Math.min(nextStart, totalCols + 1);
    
    const cols: { espCol: number; cbCol: number }[] = [];
    let col = driver.startCol;

    for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
      if (col + 1 >= blockEnd) break; // Not enough columns left
      cols.push({ espCol: col, cbCol: col + 1 });
      col += 2;
    }

    result.set(driver.name, cols);
  }

  return result;
}

/**
 * Fill data values into the existing Recap sheet of a workbook.
 * 
 * IMPORTANT: Preserves ALL existing content (formulas, formatting, headers, totals, etc.)
 * Only modifies the VALUE of data cells (day x driver x category x payment type).
 * Does NOT clear any rows or cells.
 * Row 1 = driver headers → PRESERVED
 * Row 2 = category headers → PRESERVED  
 * Row 3+ (up to 31 days) = data cells → only cell VALUES are set
 * Total columns (after categories) → NOT TOUCHED (formulas preserved)
 */
export async function fillRecapSheet(
  wb: ExcelJS.Workbook,
  data: MonthData,
  drivers: string[]
): Promise<void> {
  // Find Recap sheet (case-insensitive)
  let ws: ExcelJS.Worksheet | undefined;
  for (const wsName of wb.worksheets.map(w => w.name)) {
    if (wsName.toLowerCase() === "recap") {
      ws = wb.getWorksheet(wsName);
      break;
    }
  }
  if (!ws) throw new Error('Feuille "Recap" introuvable dans le fichier modèle');

  const daysInMonth = getDaysInMonth(data.year, data.month);

  // Detect driver names from the existing sheet header (row 1)
  const detectedDrivers = detectDrivers(ws);
  if (detectedDrivers.length === 0) {
    throw new Error("Aucun chauffeur trouvé dans la ligne 1 de la feuille Recap");
  }

  // Map each driver to their data columns
  const driverCols = getDriverDataColumns(ws, detectedDrivers);

  // Write data values for each day
  const DATA_START_ROW = 3; // Row 1 = drivers, Row 2 = categories

  for (let day = 1; day <= 31; day++) {
    const rowNum = DATA_START_ROW + day - 1;

    // Write day number in column A
    ws.getCell(rowNum, 1).value = day;

    // Only write data for days within the month
    if (day <= daysInMonth) {
      for (const driverInfo of detectedDrivers) {
        const dd = data.drivers[driverInfo.name];
        const catCols = driverCols.get(driverInfo.name);
        if (!dd || !catCols) continue;

        for (let catIdx = 0; catIdx < CATEGORIES.length && catIdx < catCols.length; catIdx++) {
          const cat = CATEGORIES[catIdx];
          const { espCol, cbCol } = catCols[catIdx];

          // Write Espèces value
          const eVal = dd.days[day]?.[getCellKey(cat, "especes")] || 0;
          const eCell = ws.getCell(rowNum, espCol);
          if (eVal > 0) {
            eCell.value = eVal;
          } else if (eCell.value != null && typeof eCell.value === "number") {
            eCell.value = null; // Clear only if it was a number
          }

          // Write CB value
          const cVal = dd.days[day]?.[getCellKey(cat, "cb")] || 0;
          const cCell = ws.getCell(rowNum, cbCol);
          if (cVal > 0) {
            cCell.value = cVal;
          } else if (cCell.value != null && typeof cCell.value === "number") {
            cCell.value = null; // Clear only if it was a number
          }

          // Red font for non-returned
          const isNREsp = !!dd.notReturned?.[`${day}_${cat}_especes`];
          const isNRCb = !!dd.notReturned?.[`${day}_${cat}_cb`];

          if (isNREsp && eVal > 0) {
            eCell.font = { ...(eCell.font || {}), color: { argb: "FFFF0000" }, bold: true };
          }
          if (isNRCb && cVal > 0) {
            cCell.font = { ...(cCell.font || {}), color: { argb: "FFFF0000" }, bold: true };
          }
        }
      }
    } else {
      // For days beyond the month, clear data cells (but NOT formulas/totals)
      for (const driverInfo of detectedDrivers) {
        const catCols = driverCols.get(driverInfo.name);
        if (!catCols) continue;

        for (const { espCol, cbCol } of catCols) {
          const eCell = ws.getCell(rowNum, espCol);
          if (eCell.value != null && typeof eCell.value === "number") {
            eCell.value = null;
          }
          const cCell = ws.getCell(rowNum, cbCol);
          if (cCell.value != null && typeof cCell.value === "number") {
            cCell.value = null;
          }
        }
      }
    }
  }
}