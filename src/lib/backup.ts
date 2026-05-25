import { MonthData, MONTH_NAMES, getDaysInMonth, CATEGORIES, PAYMENT_TYPES, getCellKey, DriverMonthData } from "./types";
import { buildWorkbook } from "./export";
import { fillRecapSheet } from "./recap-export";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const DB_NAME = "recettes_backup";
const DB_VERSION = 1;
const STORE_NAME = "handles";

// ---------- IndexedDB helpers for storing file handles ----------
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(key: string, handle: FileSystemHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getHandle(key: string): Promise<FileSystemHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function removeHandle(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ---------- Backup directory ----------
const BACKUP_DIR_KEY = "recettes_backup_dir_name";

export async function selectBackupDir(): Promise<{ name: string; handle: FileSystemDirectoryHandle } | null> {
  if (!("showDirectoryPicker" in window)) {
    return null;
  }
  try {
    const handle = await (window as any).showDirectoryPicker();
    await storeHandle("backupDir", handle);
    localStorage.setItem(BACKUP_DIR_KEY, handle.name);
    return { name: handle.name, handle };
  } catch (e: any) {
    if (e.name === "AbortError" || e.name === "SecurityError") return null;
    throw e;
  }
}

export async function getBackupDir(): Promise<{ name: string; handle: FileSystemDirectoryHandle } | null> {
  const name = localStorage.getItem(BACKUP_DIR_KEY);
  if (!name) return null;
  const handle = await getHandle("backupDir") as FileSystemDirectoryHandle | null;
  if (!handle) return null;
  try {
    const h = handle as any;
    if ((await h.queryPermission({ mode: "readwrite" })) !== "granted") {
      const result = await h.requestPermission({ mode: "readwrite" });
      if (result !== "granted") return null;
    }
    return { name, handle };
  } catch {
    return null;
  }
}

export function getBackupDirName(): string | null {
  return localStorage.getItem(BACKUP_DIR_KEY);
}

export async function clearBackupDir(): Promise<void> {
  localStorage.removeItem(BACKUP_DIR_KEY);
  await removeHandle("backupDir");
}

// ---------- Template file ----------
const TEMPLATE_FILE_KEY = "recettes_template_file_name";

export async function selectTemplateFile(): Promise<{ name: string; handle: FileSystemFileHandle } | null> {
  if (!("showOpenFilePicker" in window)) {
    return null;
  }
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: "Fichier Excel",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx", ".xlsm"],
        },
      }],
    });
    await storeHandle("templateFile", handle);
    localStorage.setItem(TEMPLATE_FILE_KEY, handle.name);
    return { name: handle.name, handle };
  } catch (e: any) {
    if (e.name === "AbortError" || e.name === "SecurityError") return null;
    throw e;
  }
}

export async function getTemplateFile(): Promise<{ name: string; handle: FileSystemFileHandle } | null> {
  const name = localStorage.getItem(TEMPLATE_FILE_KEY);
  if (!name) return null;
  const handle = await getHandle("templateFile") as FileSystemFileHandle | null;
  if (!handle) return null;
  try {
    const h = handle as any;
    if ((await h.queryPermission({ mode: "readwrite" })) !== "granted") {
      const result = await h.requestPermission({ mode: "readwrite" });
      if (result !== "granted") return null;
    }
    return { name, handle };
  } catch {
    return null;
  }
}

export function getTemplateFileName(): string | null {
  return localStorage.getItem(TEMPLATE_FILE_KEY);
}

export async function clearTemplateFile(): Promise<void> {
  localStorage.removeItem(TEMPLATE_FILE_KEY);
  await removeHandle("templateFile");
}

// ---------- New save system: copy template, fill RECAP sheet ----------

export function getSaveFileName(data: MonthData): string {
  return `Sauvegarde ${MONTH_NAMES[data.month]} ${data.year} Chateaurenard.xlsx`;
}

/**
 * Load the template workbook (from the user-selected template file).
 * Returns the workbook loaded with ExcelJS to preserve all formatting, formulas, etc.
 */
async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const template = await getTemplateFile();
  if (!template) {
    throw new Error(
      "Aucun fichier modèle sélectionné. Allez dans ⚙ Config sauvegarde > Fichier modèle vierge pour sélectionner le fichier .xlsm de référence."
    );
  }

  const file = await template.handle.getFile();
  const buf = await file.arrayBuffer();
  return await new ExcelJS.Workbook().xlsx.load(buf);
}

/**
 * Save data to a new file by copying the template and filling the RECAP sheet.
 * Uses File System Access API (save as), falls back to download.
 */
export async function saveNewBackup(data: MonthData, drivers: string[]): Promise<boolean> {
  const wb = await loadTemplateWorkbook();
  await fillRecapSheet(wb, data, drivers);
  
  const buf = await wb.xlsx.writeBuffer();
  const fileName = getSaveFileName(data);

  // Try File System Access API
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: "Fichier Excel",
          accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(buf);
      await writable.close();
      return true;
    } catch (e: any) {
      if (e.name === "AbortError") return false;
      // Fallback to download
    }
  }

  // Fallback: trigger download
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Update an existing file by reading it, filling the RECAP sheet with data,
 * and saving back to the original location.
 * Accepts an optional File object (from user selection) or uses File System Access API.
 */
export async function updateExistingBackup(
  data: MonthData,
  drivers: string[],
  existingFile?: File
): Promise<boolean> {
  let wb: ExcelJS.Workbook;
  let saveName: string;

  if (existingFile) {
    // Read the provided file
    const buf = await existingFile.arrayBuffer();
    wb = await new ExcelJS.Workbook().xlsx.load(buf);
    saveName = existingFile.name;
  } else if ("showOpenFilePicker" in window) {
    // Let user pick a file
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: "Fichier Excel (.xlsm, .xlsx)",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
        },
      }],
    });
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    wb = await new ExcelJS.Workbook().xlsx.load(buf);
    saveName = file.name;
  } else {
    throw new Error("La mise à jour de fichier n'est pas supportée par ce navigateur");
  }

  // Fill the Recap sheet with data (preserves everything: formatting, formulas, other sheets, macros)
  const recapSheet = wb.worksheets.find(w => w.name.toLowerCase() === "recap");
  if (recapSheet) {
    await fillRecapSheet(wb, data, drivers);
  } else {
    throw new Error('Le fichier sélectionné ne contient pas de feuille nommée "Recap"');
  }

  // Save the workbook
  const outBuf = await wb.xlsx.writeBuffer();

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: saveName,
        types: [{
          description: "Fichier Excel",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
          },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(outBuf);
      await writable.close();
      return true;
    } catch (e: any) {
      if (e.name === "AbortError") return false;
      // Fallback to download
    }
  }

  // Fallback: download
  const blob = new Blob([outBuf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = saveName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ---------- Export CSV ----------
export function exportToCSV(data: MonthData, drivers: string[]): void {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const sep = ";";
  const lines: string[] = [];

  // Header
  const header = ["Jour", ...drivers.flatMap(d => [`${d} Esp.`, `${d} CB`, `${d} Total`])];
  lines.push(header.join(sep));

  for (let day = 1; day <= daysInMonth; day++) {
    const row: string[] = [`${day}/${data.month + 1}`];
    for (const driver of drivers) {
      const dd = data.drivers[driver];
      const esp = dd?.days[day]?.[getCellKey("704" as any, "especes")] || 0;
      const cb = dd?.days[day]?.[getCellKey("704" as any, "cb")] || 0;
      // Sum across all categories
      let totalEsp = 0, totalCb = 0;
      if (dd?.days[day]) {
        for (const [key, val] of Object.entries(dd.days[day])) {
          if (key.endsWith("_especes")) totalEsp += val;
          else if (key.endsWith("_cb")) totalCb += val;
        }
      }
      row.push(totalEsp.toFixed(2).replace(".", ","));
      row.push(totalCb.toFixed(2).replace(".", ","));
      row.push((totalEsp + totalCb).toFixed(2).replace(".", ","));
    }
    lines.push(row.join(sep));
  }

  const totals = ["TOTAL", ...drivers.flatMap(d => {
    let te = 0, tc = 0;
    const dd = data.drivers[d];
    if (dd) {
      for (let day = 1; day <= daysInMonth; day++) {
        if (dd.days[day]) {
          for (const [key, val] of Object.entries(dd.days[day])) {
            if (key.endsWith("_especes")) te += val;
            else if (key.endsWith("_cb")) tc += val;
          }
        }
      }
    }
    return [te.toFixed(2).replace(".", ","), tc.toFixed(2).replace(".", ","), (te + tc).toFixed(2).replace(".", ",")];
  })];
  lines.push(totals.join(sep));

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;header=present" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Caisses_${MONTH_NAMES[data.month]}_${data.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Helper to add a "Recap" sheet compatible with importWorkbookFile ----------
/**
 * Adds a "Recap" sheet to the workbook in the exact format that importWorkbookFile() expects.
 * This allows backup files to be reimported into the app if needed.
 * Format:
 *   Row 0: driver names positioned at their block start columns
 *   Row 1: headers alternating category name / "CB"
 *   Rows 2+: day numbers in col A, then data in driver blocks
 */
function addRecapSheet(wb: XLSX.WorkBook, data: MonthData, drivers: string[]): void {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const colsPerDriver = CATEGORIES.length * 2; // Esp. + CB per category

  // Build rows properly
  const driverRow: (string | null)[] = [null]; // col A = day number, no driver name there
  const headerRow: (string | null)[] = [null];
  let col = 1; // 0 = day number column
  drivers.forEach((driver) => {
    driverRow[col] = driver;
    CATEGORIES.forEach((cat, cIdx) => {
      headerRow[col + cIdx * 2] = cat;
      headerRow[col + cIdx * 2 + 1] = "CB";
    });
    col += colsPerDriver;
    // Fill nulls up to the next driver start
    while (driverRow.length < col) driverRow.push(null);
    while (headerRow.length < col) headerRow.push(null);
  });

  const rows: (string | number | null)[][] = [driverRow, headerRow];

  // Data rows
  for (let day = 1; day <= daysInMonth; day++) {
    const row: (string | number | null)[] = [day];
    drivers.forEach((driver) => {
      const dd = data.drivers[driver];
      CATEGORIES.forEach((cat) => {
        const e = dd?.days[day]?.[getCellKey(cat, "especes")] || 0;
        const c = dd?.days[day]?.[getCellKey(cat, "cb")] || 0;
        row.push(e || null);
        row.push(c || null);
      });
    });
    rows.push(row);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths for readability
  sheet["!cols"] = [{ wch: 4 }, ...drivers.map(() => [{ wch: 10 }, { wch: 10 }]).flat()];

  XLSX.utils.book_append_sheet(wb, sheet, "Recap");
}

// ---------- Save backup (auto-save to configured directory) ----------
export async function saveBackup(data: MonthData, drivers: string[]): Promise<boolean> {
  const dir = await getBackupDir();
  if (!dir) return false;

  const monthLabel = `Recettes_Lignes_${MONTH_NAMES[data.month]}_${data.year}`;
  const fileName = `${monthLabel}.xlsx`;

  const template = await getTemplateFile();

  if (template) {
    try {
      // Load template with ExcelJS to preserve all formatting, macros, formulas, etc.
      const file = await template.handle.getFile();
      const buf = await file.arrayBuffer();
      const wb = await new ExcelJS.Workbook().xlsx.load(buf);

      // Fill the Recap sheet with data (preserves everything else)
      await fillRecapSheet(wb, data, drivers);

      // Write the workbook back to a buffer
      const outBuf = await wb.xlsx.writeBuffer();

      // Save to the backup directory
      const fileHandle = await dir.handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array(outBuf));
      await writable.close();
      return true;
    } catch (e) {
      console.warn("Template backup failed, falling back to standard export", e);
    }
  }

  try {
    const wb = buildWorkbook(data, drivers);
    // Add a "Recap" sheet for reimport compatibility
    addRecapSheet(wb, data, drivers);
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileHandle = await dir.handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Uint8Array(buf));
    await writable.close();
    return true;
  } catch (e) {
    console.warn("Backup save failed", e);
    return false;
  }
}