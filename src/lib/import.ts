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
function parseRecapSheet(sheet: XLSX.WorkSheet, daysInMonth: number, redCells: Set<string>): Record<string, DriverMonthData> {
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
          // Check cell style for red font => non rendu (ExcelJS uses 1-based row/col)
          if (redCells.has(`${r + 1},${col + 1}`)) {
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
  const wb = XLSX.read(buf, { type: "array" });

  // Parse with ExcelJS in parallel to access font color styles
  const ejsWb = new ExcelJS.Workbook();
  await ejsWb.xlsx.load(buf);

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

  const ejsSheet = ejsWb.getWorksheet(recapName);
  const redCells = ejsSheet ? buildRedCellSet(ejsSheet) : new Set<string>();

  const driversData = parseRecapSheet(wb.Sheets[recapName], daysInMonth, redCells);
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

// =====================================================================
// Extraction import: ventes-realises-orientees-reseau_*.xlsx
// Reads daily sales per driver/line/payment and produces extracts data.
// =====================================================================

export type SkipReason =
  | "annulee"
  | "ligne_inconnue"
  | "prix_invalide"
  | "conducteur_vide"
  | "date_invalide"
  | "hors_mois";

export interface SkippedRow {
  reason: SkipReason;
  sheet: string;
  row: number; // 1-based row index in the sheet
  date: string;
  conducteur: string;
  ligne: string;
  prix: string;
}

export interface ExtractionImportResult {
  year: number;
  month: number;
  byDriver: Record<string, Record<number, Record<string, number>>>; // driverNorm -> day -> "cat_pay" -> total
  driversFound: string[]; // normalized names found
  rowCount: number;
  skipped: SkippedRow[];
  totalRows: number;
}

export function normalizeDriverName(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Strip apostrophe-like marks WITHOUT inserting a space, so "M'HAYA",
    // "M’HAYA", "Mʼ HAYA" all collapse to "MHAYA".
    .replace(/['’‘‛`´ʼ′ʻˈ]/g, "")
    // Replace remaining non-letter chars (hyphens, dots, slashes, digits…)
    // by a space so "JEAN-LUC" → "JEAN LUC".
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function lineToCategory(ligne: unknown): Category | null {
  if (ligne == null) return null;
  const s = String(ligne).trim();
  // Try 4-digit first (Scolaires 7400-7404 et 7500-7507)
  const m4 = s.match(/^(\d{4})/);
  if (m4) {
    const code = m4[1];
    if (["7400", "7401", "7402", "7403", "7404",
         "7500", "7501", "7502", "7503", "7504", "7505", "7506", "7507"].includes(code)) return "Scolaires";
  }
  const m3 = s.match(/^(\d{3})/);
  if (m3) {
    const code = m3[1];
    if (["704", "705", "707", "708", "915"].includes(code)) return code as Category;
  }
  return null;
}

function paymentToType(p: unknown): "especes" | "cb" {
  const s = String(p || "").toLowerCase();
  if (/esp[èe]ce/.test(s)) return "especes";
  return "cb";
}

function parseExtractionMonthYear(fileName: string): { year: number; month: number } | null {
  const m = fileName.match(/(\d{4})-(\d{2})-\d{2}/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    if (mo >= 0 && mo <= 11) return { year: y, month: mo };
  }
  return null;
}

type DateParts = { y: number; m: number; d: number };
type DateCellValue = { raw: unknown; text: string | null };

function dateParts(y: number, m: number, d: number): DateParts | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

function parseDateText(s: string, expectedMonth?: number): DateParts | null {
  const trimmed = s.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return dateParts(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));

  const fr = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!fr) return null;
  let y = parseInt(fr[3], 10);
  if (y < 100) y += 2000;
  const a = parseInt(fr[1], 10);
  const b = parseInt(fr[2], 10);
  const dmy = dateParts(y, b - 1, a);
  const mdy = dateParts(y, a - 1, b);
  if (expectedMonth != null) {
    if (dmy?.m === expectedMonth) return dmy;
    if (mdy?.m === expectedMonth) return mdy;
  }
  return dmy || mdy;
}

// Robust date extraction returning {y,m,d} (m 0-indexed) — avoids timezone shift.
function parseRowDate(v: unknown, expectedMonth?: number): DateParts | null {
  if (v == null || v === "") return null;
  if (typeof v === "object" && "raw" in (v as Record<string, unknown>)) {
    const cell = v as DateCellValue;
    const fromText = cell.text ? parseDateText(cell.text, expectedMonth) : null;
    return fromText || parseRowDate(cell.raw, expectedMonth);
  }
  if (v instanceof Date) {
    const local = dateParts(v.getFullYear(), v.getMonth(), v.getDate());
    const utc = dateParts(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
    if (expectedMonth != null) {
      if (local?.m === expectedMonth) return local;
      if (utc?.m === expectedMonth) return utc;
    }
    const isUtcMidnight = v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0;
    return isUtcMidnight ? utc : local;
  }
  if (typeof v === "number") {
    const parsed: any = (XLSX as any).SSF?.parse_date_code?.(v);
    if (parsed && parsed.y) return dateParts(parsed.y, parsed.m - 1, parsed.d);
  }
  if (typeof v === "string") {
    return parseDateText(v, expectedMonth);
  }
  return null;
}

export async function importExtractionFile(file: File): Promise<ExtractionImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  if (wb.SheetNames.length === 0) throw new Error("Fichier vide");

  // Read each sheet as AOA, locate the header row, then map by column index.
  // The extraction file has the date in column 2 (index 1).
  type Row = {
    sheet: string;
    rowNum: number;
    date: unknown;
    conducteur: unknown;
    ligne: unknown;
    prix: unknown;
    paiement: unknown;
    annulee: unknown;
  };
  const rows: Row[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    const headerIdx = aoa.findIndex((r) =>
      Array.isArray(r) && r.some((c) => typeof c === "string" && /conducteur/i.test(c))
    );
    if (headerIdx < 0) continue;
    const headers = (aoa[headerIdx] as unknown[]).map((h) => String(h ?? "").toLowerCase());
    const findCol = (re: RegExp) => headers.findIndex((h) => re.test(h));
    const dateCol = 1;
    const condCol = findCol(/conducteur/);
    const ligneCol = findCol(/ligne/);
    const prixCol = findCol(/prix.*ttc|^ttc|montant/);
    const payCol = findCol(/paiement|moyen/);
    const annulCol = findCol(/annul/);
    if (condCol < 0 || ligneCol < 0 || prixCol < 0) continue;

    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!Array.isArray(r)) continue;
      // Skip fully empty rows silently
      if (r.every((c) => c == null || c === "")) continue;
      rows.push({
        sheet: sheetName,
        rowNum: i + 1,
        date: r[dateCol],
        conducteur: r[condCol],
        ligne: r[ligneCol],
        prix: r[prixCol],
        paiement: payCol >= 0 ? r[payCol] : null,
        annulee: annulCol >= 0 ? r[annulCol] : null,
      });
    }
  }

  if (rows.length === 0) throw new Error("Aucune ligne dans le fichier");

  let my = parseExtractionMonthYear(file.name);
  if (!my) {
    for (const r of rows) {
      const pd = parseRowDate(r.date);
      if (pd) { my = { year: pd.y, month: pd.m }; break; }
    }
  }
  if (!my) throw new Error("Impossible de déterminer le mois/année");

  const byDriver: Record<string, Record<number, Record<string, number>>> = {};
  let rowCount = 0;
  const skipped: SkippedRow[] = [];
  const fmtDate = (v: unknown) => {
    if (v instanceof Date) return v.toLocaleDateString("fr-FR");
    return v == null ? "" : String(v);
  };
  const pushSkip = (row: Row, reason: SkipReason) => {
    skipped.push({
      reason,
      sheet: row.sheet,
      row: row.rowNum,
      date: fmtDate(row.date),
      conducteur: String(row.conducteur ?? ""),
      ligne: String(row.ligne ?? ""),
      prix: row.prix == null ? "" : String(row.prix),
    });
  };

  for (const row of rows) {
    if (String(row.annulee || "").toLowerCase() === "oui") { pushSkip(row, "annulee"); continue; }
    const cat = lineToCategory(row.ligne);
    if (!cat) { pushSkip(row, "ligne_inconnue"); continue; }
    const prix = Number(row.prix);
    if (!prix || isNaN(prix)) { pushSkip(row, "prix_invalide"); continue; }
    const driverNorm = normalizeDriverName(String(row.conducteur || ""));
    if (!driverNorm) { pushSkip(row, "conducteur_vide"); continue; }
    const pd = parseRowDate(row.date);
    if (!pd) { pushSkip(row, "date_invalide"); continue; }
    if (pd.y !== my.year || pd.m !== my.month) { pushSkip(row, "hors_mois"); continue; }
    const day = pd.d;
    if (!day || day < 1 || day > 31) { pushSkip(row, "date_invalide"); continue; }
    const pay = paymentToType(row.paiement);
    const key = getCellKey(cat, pay);
    if (!byDriver[driverNorm]) byDriver[driverNorm] = {};
    if (!byDriver[driverNorm][day]) byDriver[driverNorm][day] = {};
    byDriver[driverNorm][day][key] = (byDriver[driverNorm][day][key] || 0) + prix;
    rowCount++;
  }

  for (const dn of Object.keys(byDriver)) {
    for (const day of Object.keys(byDriver[dn])) {
      const e = byDriver[dn][Number(day)];
      for (const k of Object.keys(e)) e[k] = Math.round(e[k] * 100) / 100;
    }
  }

  return {
    year: my.year,
    month: my.month,
    byDriver,
    driversFound: Object.keys(byDriver),
    rowCount,
    skipped,
    totalRows: rows.length,
  };
}

const COMPOUND_PREFIXES = new Set(["EL", "LE", "LA", "DE", "DU", "DA", "DI", "DEL", "VAN", "VON"]);

export interface ParsedDriverName {
  lastName: string;
  initial: string | null;
}

// Parse an app driver entry: "PREAUX A" -> {last:"PREAUX", initial:"A"}
// "EL BADRI" -> {last:"EL BADRI", initial:null}
// "ABBADI" -> {last:"ABBADI", initial:null}
export function parseAppDriverName(raw: string): ParsedDriverName {
  const norm = normalizeDriverName(raw);
  const tokens = norm.split(" ").filter(Boolean);
  if (tokens.length === 0) return { lastName: "", initial: null };
  if (tokens.length >= 2 && tokens[tokens.length - 1].length === 1) {
    return { lastName: tokens.slice(0, -1).join(" "), initial: tokens[tokens.length - 1] };
  }
  return { lastName: tokens.join(" "), initial: null };
}

// Parse a file driver entry: "Anthony PREAUX" -> {last:"PREAUX", initial:"A"}
// "Kamel HAJJI" -> {last:"HAJJI", initial:"K"}
// composed: handle "Foo EL BADRI" -> {last:"EL BADRI", initial:"F"}
export function parseFileDriverName(raw: string): ParsedDriverName {
  const norm = normalizeDriverName(raw);
  const tokens = norm.split(" ").filter(Boolean);
  if (tokens.length === 0) return { lastName: "", initial: null };
  if (tokens.length === 1) return { lastName: tokens[0], initial: null };
  let lastCount = 1;
  if (tokens.length >= 3 && COMPOUND_PREFIXES.has(tokens[tokens.length - 2])) lastCount = 2;
  const lastName = tokens.slice(tokens.length - lastCount).join(" ");
  const first = tokens[0];
  return { lastName, initial: first ? first[0] : null };
}
