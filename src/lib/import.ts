import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth, MONTH_NAMES, DriverMonthData, Category } from "./types";

export interface ImportResult {
  data: MonthData;
  driversFound: string[];
  fileName: string;
}

// Parse "Recettes Lignes 04 - 2026" or similar in filename
function parseMonthYearFromName(fileName: string): { year: number; month: number } | null {
  const base = fileName.replace(/\.xlsx?m?$/i, "");
  // Try MM - YYYY or MM-YYYY or MM_YYYY
  const numMatch = base.match(/(\d{1,2})\s*[-_/]\s*(\d{4})/);
  if (numMatch) {
    const m = parseInt(numMatch[1], 10) - 1;
    const y = parseInt(numMatch[2], 10);
    if (m >= 0 && m <= 11) return { year: y, month: m };
  }
  // Try MonthName YYYY
  const lower = base.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const mn = MONTH_NAMES[i].toLowerCase();
    if (lower.includes(mn)) {
      const yMatch = base.match(/(\d{4})/);
      if (yMatch) return { year: parseInt(yMatch[1], 10), month: i };
    }
  }
  return null;
}

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): string | null {
  const lower = wb.SheetNames.map((s) => s.toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx >= 0) return wb.SheetNames[idx];
  }
  return null;
}

// Detect red-ish font color from an ExcelJS color object
function isRedExcelJSColor(color: any): boolean {
  if (!color) return false;
  if (typeof color.argb === "string") {
    const hex = color.argb.length === 8 ? color.argb.slice(2) : color.argb;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return r > 150 && g < 100 && b < 100;
  }
  if (typeof color.indexed === "number" && (color.indexed === 2 || color.indexed === 10)) return true;
  if (typeof color.theme === "number" && color.theme === 5) return true;
  return false;
}

// Build a set of "r,c" (1-based, matching ExcelJS) keys for cells with red font in a sheet
function buildRedCellSet(sheet: ExcelJS.Worksheet): Set<string> {
  const set = new Set<string>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (isRedExcelJSColor(cell.font?.color)) {
        set.add(`${rowNumber},${colNumber}`);
      }
    });
  });
  return set;
}

// Parse the "Recap" sheet: row 1 = driver names (every N cols), row 2 = headers, col A = day
function parseRecapSheet(sheet: XLSX.WorkSheet, daysInMonth: number): Record<string, DriverMonthData> {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  if (aoa.length < 3) return {};

  const driverRow = aoa[0] as unknown[];
  const headerRow = aoa[1] as unknown[];

  // Find driver blocks: column index -> driver name
  const driverBlocks: { col: number; name: string }[] = [];
  driverRow.forEach((v, idx) => {
    if (v != null && String(v).trim() !== "") {
      driverBlocks.push({ col: idx, name: String(v).trim().toUpperCase() });
    }
  });
  if (driverBlocks.length === 0) return {};

  // For each block, map relative column -> {category, payment}
  // Pattern within a block: cat1, CB, cat2, CB, ..., cat6, CB
  // We read header row at the block's start to discover categories
  const result: Record<string, DriverMonthData> = {};

  driverBlocks.forEach((block, bIdx) => {
    const nextCol = bIdx + 1 < driverBlocks.length ? driverBlocks[bIdx + 1].col : headerRow.length;
    const blockMap: { col: number; cat: Category; pay: "especes" | "cb" }[] = [];
    let currentCat: Category | null = null;
    for (let c = block.col; c < nextCol; c++) {
      const h = headerRow[c];
      if (h == null) continue;
      const hStr = String(h).trim();
      // Match a category (number or "Scolaires")
      const cat = CATEGORIES.find((cat) => cat.toLowerCase() === hStr.toLowerCase());
      if (cat) {
        currentCat = cat;
        blockMap.push({ col: c, cat, pay: "especes" });
      } else if (/^cb$/i.test(hStr) && currentCat) {
        blockMap.push({ col: c, cat: currentCat, pay: "cb" });
      }
    }
    if (blockMap.length === 0) return;

    const dd: DriverMonthData = { days: {}, notReturned: {} };
    // Day rows start at aoa index 2 (row 3)
    for (let r = 2; r < aoa.length; r++) {
      const row = aoa[r] as unknown[];
      if (!row) continue;
      const dayVal = row[0];
      const day = typeof dayVal === "number" ? dayVal : parseInt(String(dayVal ?? ""), 10);
      if (!day || day < 1 || day > daysInMonth) continue;
      const dayEntry: Record<string, number> = {};
      let hasValue = false;
      blockMap.forEach(({ col, cat, pay }) => {
        const num = toNumber(row[col]);
        if (num !== 0) {
          dayEntry[getCellKey(cat, pay)] = num;
          hasValue = true;
          // Check cell style for red font => non rendu
          const addr = XLSX.utils.encode_cell({ c: col, r });
          const cell: any = (sheet as any)[addr];
          if (cell && isRedFont(cell.s)) {
            dd.notReturned![`${day}_${cat}_${pay}`] = true;
          }
        }
      });
      if (hasValue) dd.days[day] = dayEntry;
    }
    if (Object.keys(dd.notReturned!).length === 0) delete dd.notReturned;
    if (Object.keys(dd.days).length > 0) {
      result[block.name] = dd;
    }
  });

  return result;
}

function parseDriverList(sheet: XLSX.WorkSheet): string[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const names: string[] = [];
  for (const row of aoa) {
    if (!row) continue;
    for (const v of row) {
      if (v != null && String(v).trim() !== "") {
        names.push(String(v).trim().toUpperCase());
        break;
      }
    }
  }
  return names;
}

export async function importWorkbookFile(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellStyles: true });

  const my = parseMonthYearFromName(file.name);
  if (!my) {
    throw new Error(
      `Impossible de déterminer le mois/année depuis "${file.name}". Format attendu : "Recettes Lignes MM - YYYY".`
    );
  }
  const { year, month } = my;
  const daysInMonth = getDaysInMonth(year, month);

  const recapName = findSheet(wb, ["Recap", "Récap", "Recapitulatif", "Récapitulatif"]);
  if (!recapName) {
    throw new Error(`Feuille "Recap" introuvable dans "${file.name}".`);
  }

  const driversData = parseRecapSheet(wb.Sheets[recapName], daysInMonth);
  const driversFound = Object.keys(driversData);

  // Also gather full driver list from "Liste Chauffeurs" if present
  const listName = findSheet(wb, ["Liste Chauffeurs", "Liste", "Chauffeurs"]);
  const fullList = listName ? parseDriverList(wb.Sheets[listName]) : [];
  const allDrivers = Array.from(new Set([...fullList, ...driversFound])).sort();

  if (driversFound.length === 0) {
    throw new Error(`Aucune donnée chauffeur trouvée dans la feuille "${recapName}".`);
  }

  const monthData: MonthData = { year, month, drivers: driversData, days: {} };

  return { data: monthData, driversFound: allDrivers, fileName: file.name };
}
