import * as XLSX from "xlsx";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth, MONTH_NAMES, DriverMonthData, Category } from "./types";

export interface ImportResult {
  data: MonthData;
  driversFound: string[];
  fileName: string;
}

// Parse "Recettes Lignes 04 - 2026" or similar in filename
function parseMonthYearFromName(fileName: string): { year: number; month: number } | null {
  const base = fileName.replace(/\.xlsx?$/i, "");
  // Try MM - YYYY or MM-YYYY
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
    const idx = lower.indexOf(mn);
    if (idx >= 0) {
      const yMatch = base.slice(idx).match(/(\d{4})/);
      if (yMatch) return { year: parseInt(yMatch[1], 10), month: i };
    }
  }
  return null;
}

const RESERVED_SHEETS = new Set(["Tableau de bord", "Récapitulatif", "Recapitulatif"]);

// Match an export per-driver sheet: header row "Jour | 704 Esp. | 704 CB | ... | Total"
function parseDriverSheet(sheet: XLSX.WorkSheet, daysInMonth: number): DriverMonthData | null {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  // Find header row containing "Jour"
  let headerRow = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i] || [];
    if (row.some((c) => typeof c === "string" && c.trim().toLowerCase() === "jour")) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return null;

  const header = (aoa[headerRow] as unknown[]).map((c) => String(c ?? "").trim());
  // Map column index -> {category, paymentType}
  const colMap: Record<number, { cat: Category; pay: "especes" | "cb" }> = {};
  header.forEach((h, idx) => {
    const m = h.match(/^(\S+)\s+(Esp\.?|Espèces|CB)$/i);
    if (m) {
      const catRaw = m[1];
      const cat = CATEGORIES.find((c) => c.toLowerCase() === catRaw.toLowerCase()) as Category | undefined;
      if (!cat) return;
      const pay: "especes" | "cb" = /cb/i.test(m[2]) ? "cb" : "especes";
      colMap[idx] = { cat, pay };
    }
  });
  if (Object.keys(colMap).length === 0) return null;

  const dayColIdx = header.findIndex((h) => h.toLowerCase() === "jour");
  const result: DriverMonthData = { days: {} };
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] as unknown[];
    if (!row) continue;
    const dayVal = row[dayColIdx];
    const day = typeof dayVal === "number" ? dayVal : parseInt(String(dayVal), 10);
    if (!day || day < 1 || day > daysInMonth) continue;
    const dayEntry: Record<string, number> = {};
    let hasValue = false;
    Object.entries(colMap).forEach(([idxStr, { cat, pay }]) => {
      const v = row[parseInt(idxStr, 10)];
      const num = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      if (!isNaN(num) && num !== 0) {
        dayEntry[getCellKey(cat, pay)] = num;
        hasValue = true;
      }
    });
    if (hasValue) result.days[day] = dayEntry;
  }
  return Object.keys(result.days).length > 0 ? result : null;
}

export async function importWorkbookFile(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const my = parseMonthYearFromName(file.name);
  if (!my) {
    throw new Error(
      `Impossible de déterminer le mois/année depuis "${file.name}". Format attendu : "Recettes Lignes MM - YYYY".`
    );
  }
  const { year, month } = my;
  const daysInMonth = getDaysInMonth(year, month);

  const monthData: MonthData = { year, month, drivers: {}, days: {} };
  const driversFound: string[] = [];

  for (const sheetName of wb.SheetNames) {
    if (RESERVED_SHEETS.has(sheetName)) continue;
    const sheet = wb.Sheets[sheetName];
    const dd = parseDriverSheet(sheet, daysInMonth);
    if (dd) {
      // Use sheet name as driver name (export truncates to 31 chars)
      const driverName = sheetName.trim().toUpperCase();
      monthData.drivers[driverName] = dd;
      driversFound.push(driverName);
    }
  }

  if (driversFound.length === 0) {
    throw new Error(`Aucun chauffeur détecté dans "${file.name}". Vérifiez que les feuilles contiennent bien les colonnes "Jour", "704 Esp.", "704 CB", etc.`);
  }

  return { data: monthData, driversFound, fileName: file.name };
}
