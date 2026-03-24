import * as XLSX from "xlsx";
import { MonthData, CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MONTH_NAMES } from "./types";

const SAVE_DIR_KEY = "recettes_save_dir_handle";

export function buildWorkbook(data: MonthData, drivers: string[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const monthLabel = `${MONTH_NAMES[data.month]} ${data.year}`;

  // Recap sheet
  const recapRows: (string | number)[][] = [];
  const header = ["Chauffeur"];
  CATEGORIES.forEach((cat) => {
    header.push(`${cat} Espèces`, `${cat} CB`);
  });
  header.push("Total Espèces", "Total CB", "Total Général", "Non rendu");
  recapRows.push(header);

  drivers.forEach((driver) => {
    const dd = data.drivers[driver];
    const row: (string | number)[] = [driver];
    let totalE = 0, totalC = 0, totalNR = 0;
    CATEGORIES.forEach((cat) => {
      let e = 0, c = 0;
      if (dd) {
        for (let d = 1; d <= daysInMonth; d++) {
          e += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          c += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
          if (dd.notReturned?.[`${d}_${cat}_especes`]) totalNR += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          if (dd.notReturned?.[`${d}_${cat}_cb`]) totalNR += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
        }
      }
      totalE += e; totalC += c;
      row.push(e, c);
    });
    row.push(totalE, totalC, totalE + totalC, totalNR);
    recapRows.push(row);
  });

  const recapSheet = XLSX.utils.aoa_to_sheet(recapRows);
  XLSX.utils.book_append_sheet(wb, recapSheet, "Récapitulatif");

  // Per-driver sheets
  drivers.forEach((driver) => {
    const dd = data.drivers[driver];
    const rows: (string | number)[][] = [];
    const h = ["Jour"];
    CATEGORIES.forEach((cat) => { h.push(`${cat} Esp.`, `${cat} CB`); });
    h.push("Total");
    rows.push(h);

    for (let d = 1; d <= daysInMonth; d++) {
      const row: (string | number)[] = [d];
      let dayTotal = 0;
      CATEGORIES.forEach((cat) => {
        const e = dd?.days[d]?.[getCellKey(cat, "especes")] || 0;
        const c = dd?.days[d]?.[getCellKey(cat, "cb")] || 0;
        row.push(e, c);
        dayTotal += e + c;
      });
      row.push(dayTotal);
      rows.push(row);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const name = driver.substring(0, 31); // Excel 31 char limit
    XLSX.utils.book_append_sheet(wb, sheet, name);
  });

  return wb;
}

export async function saveWithFilePicker(data: MonthData, drivers: string[]): Promise<boolean> {
  const wb = buildWorkbook(data, drivers);
  const monthLabel = `Recettes_Lignes_${MONTH_NAMES[data.month]}_${data.year}`;
  const fileName = `${monthLabel}.xlsx`;

  // Try File System Access API (Chrome/Edge)
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
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      await writable.write(new Uint8Array(buf));
      await writable.close();

      // Remember the directory name for display
      try {
        localStorage.setItem(SAVE_DIR_KEY, handle.name);
      } catch { /* ignore */ }

      return true;
    } catch (e: any) {
      if (e.name === "AbortError") return false; // user cancelled
      // Fallback to download
    }
  }

  // Fallback: trigger download
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function getLastSaveLocation(): string | null {
  return localStorage.getItem(SAVE_DIR_KEY);
}
