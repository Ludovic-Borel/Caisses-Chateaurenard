import * as XLSX from "xlsx";
import { MonthData, CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MONTH_NAMES } from "./types";

function addSheetHeader(sheet: XLSX.WorkSheet, title: string, colCount: number): void {
  // Row 0: Company name
  // Row 1: Title (month/driver)
  // Row 2: empty spacer
  // Merge across all columns
  if (!sheet["!merges"]) sheet["!merges"] = [];
  sheet["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  sheet["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  XLSX.utils.sheet_add_aoa(sheet, [["Pastouret Rubans-Bleus"], [title], []], { origin: "A1" });
}

function applyCellStyle(sheet: XLSX.WorkSheet, row: number, col: number, style: any): void {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  if (!sheet[ref]) {
    sheet[ref] = { t: "s", v: "" };
  }
  sheet[ref].s = { ...sheet[ref].s, ...style } as any;
}

export function buildWorkbook(data: MonthData, drivers: string[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const monthLabel = `${MONTH_NAMES[data.month]} ${data.year}`;
  const HEADER_ROWS = 3;

  // ========== DASHBOARD SHEET ==========
  buildDashboardSheet(wb, data, drivers, daysInMonth, monthLabel, HEADER_ROWS);

  // ========== RECAP SHEET ==========
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

  const recapSheet = XLSX.utils.aoa_to_sheet([]);
  addSheetHeader(recapSheet, `Récapitulatif — ${monthLabel}`, header.length);
  XLSX.utils.sheet_add_aoa(recapSheet, recapRows, { origin: { r: HEADER_ROWS, c: 0 } });
  XLSX.utils.book_append_sheet(wb, recapSheet, "Récapitulatif");

  // ========== PER-DRIVER SHEETS ==========
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

    const sheet = XLSX.utils.aoa_to_sheet([]);
    addSheetHeader(sheet, `${driver} — ${monthLabel}`, h.length);
    XLSX.utils.sheet_add_aoa(sheet, rows, { origin: { r: HEADER_ROWS, c: 0 } });

    // Apply styles: red for non-returned, orange for totals match but cells differ (extract comparison)
    if (dd) {
      for (let d = 1; d <= daysInMonth; d++) {
        CATEGORIES.forEach((cat, catIdx) => {
          const colE = HEADER_ROWS + 1 + d - 1; // row in the sheet
          const baseCol = 1 + catIdx * 2; // column for this cat's Esp.
          
          // Red for non-returned
          if (dd.notReturned?.[`${d}_${cat}_especes`]) {
            applyCellStyle(sheet, HEADER_ROWS + 1 + (d - 1), baseCol, { font: { color: { rgb: "FF0000" }, bold: true } });
          }
          if (dd.notReturned?.[`${d}_${cat}_cb`]) {
            applyCellStyle(sheet, HEADER_ROWS + 1 + (d - 1), baseCol + 1, { font: { color: { rgb: "FF0000" }, bold: true } });
          }

          // Orange for totals match but cells differ (extract comparison)
          if (dd.extracts?.[d]) {
            const enteredE = dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            const enteredC = dd.days[d]?.[getCellKey(cat, "cb")] || 0;
            const extractE = dd.extracts[d]?.[getCellKey(cat, "especes")] || 0;
            const extractC = dd.extracts[d]?.[getCellKey(cat, "cb")] || 0;
            const enteredTotal = enteredE + enteredC;
            const extractTotal = extractE + extractC;
            const totalsMatch = enteredTotal > 0 && extractTotal > 0 && Math.abs(enteredTotal - extractTotal) <= 0.01;
            const cellsDiffer = (enteredE > 0 || enteredC > 0) && (Math.abs(enteredE - extractE) > 0.01 || Math.abs(enteredC - extractC) > 0.01);
            
            if (totalsMatch && cellsDiffer) {
              if (extractE > 0) {
                applyCellStyle(sheet, HEADER_ROWS + 1 + (d - 1), baseCol, { fill: { fgColor: { rgb: "FFCC66" } } });
              }
              if (extractC > 0) {
                applyCellStyle(sheet, HEADER_ROWS + 1 + (d - 1), baseCol + 1, { fill: { fgColor: { rgb: "FFCC66" } } });
              }
            }
          }
        });
      }
    }

    const name = driver.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  });

  return wb;
}

function buildDashboardSheet(
  wb: XLSX.WorkBook, data: MonthData, drivers: string[],
  daysInMonth: number, monthLabel: string, HEADER_ROWS: number
): void {
  const DASH_COLS = 8;
  const rows: (string | number)[][] = [];

  // --- Totaux généraux ---
  let grandEspeces = 0, grandCB = 0, grandNR = 0;
  const perCat: Record<string, { especes: number; cb: number }> = {};
  CATEGORIES.forEach(c => { perCat[c] = { especes: 0, cb: 0 }; });

  const perDriver: { name: string; especes: number; cb: number; total: number; nr: number }[] = [];
  const perDay: { day: number; total: number }[] = [];

  drivers.forEach((driver) => {
    const dd = data.drivers[driver];
    let dE = 0, dC = 0, dNR = 0;
    if (dd) {
      for (let d = 1; d <= daysInMonth; d++) {
        CATEGORIES.forEach((cat) => {
          const e = dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          const c = dd.days[d]?.[getCellKey(cat, "cb")] || 0;
          dE += e; dC += c;
          perCat[cat].especes += e;
          perCat[cat].cb += c;
          if (dd.notReturned?.[`${d}_${cat}_especes`]) dNR += e;
          if (dd.notReturned?.[`${d}_${cat}_cb`]) dNR += c;
        });
      }
    }
    grandEspeces += dE; grandCB += dC; grandNR += dNR;
    perDriver.push({ name: driver, especes: dE, cb: dC, total: dE + dC, nr: dNR });
  });

  for (let d = 1; d <= daysInMonth; d++) {
    let dayTotal = 0;
    drivers.forEach((driver) => {
      const dd = data.drivers[driver];
      if (dd) {
        CATEGORIES.forEach((cat) => {
          dayTotal += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          dayTotal += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
        });
      }
    });
    perDay.push({ day: d, total: dayTotal });
  }

  const grandTotal = grandEspeces + grandCB;
  const activeDrivers = perDriver.filter(d => d.total > 0);
  const driversWithNR = perDriver.filter(d => d.nr > 0);

  // Section 1: Synthèse globale
  rows.push(["SYNTHÈSE GLOBALE", "", "", "", "", "", "", ""]);
  rows.push(["", "Total Espèces", "Total CB", "Total Général", "Non rendu", "Chauffeurs actifs", "Jours avec recettes", ""]);
  rows.push([
    "",
    grandEspeces, grandCB, grandTotal, grandNR,
    activeDrivers.length,
    perDay.filter(d => d.total > 0).length,
    ""
  ]);
  rows.push([]);

  // Section 2: Répartition par ligne
  rows.push(["RÉPARTITION PAR LIGNE", "", "", "", "", "", "", ""]);
  rows.push(["", "Ligne", "Espèces", "CB", "Total", "% du total", "", ""]);
  CATEGORIES.forEach((cat) => {
    const catTotal = perCat[cat].especes + perCat[cat].cb;
    rows.push([
      "", cat, perCat[cat].especes, perCat[cat].cb, catTotal,
      grandTotal > 0 ? Math.round((catTotal / grandTotal) * 10000) / 100 : 0,
      "", ""
    ]);
  });
  rows.push([]);

  // Section 3: Répartition Espèces / CB
  rows.push(["RÉPARTITION PAR MODE DE PAIEMENT", "", "", "", "", "", "", ""]);
  rows.push(["", "Mode", "Montant", "% du total", "", "", "", ""]);
  rows.push(["", "Espèces", grandEspeces, grandTotal > 0 ? Math.round((grandEspeces / grandTotal) * 10000) / 100 : 0, "", "", "", ""]);
  rows.push(["", "CB", grandCB, grandTotal > 0 ? Math.round((grandCB / grandTotal) * 10000) / 100 : 0, "", "", "", ""]);
  rows.push([]);

  // Section 4: Top 10 chauffeurs
  const top10 = [...activeDrivers].sort((a, b) => b.total - a.total).slice(0, 10);
  rows.push(["TOP 10 CHAUFFEURS", "", "", "", "", "", "", ""]);
  rows.push(["", "#", "Chauffeur", "Espèces", "CB", "Total", "% du total", ""]);
  top10.forEach((d, i) => {
    rows.push([
      "", i + 1, d.name, d.especes, d.cb, d.total,
      grandTotal > 0 ? Math.round((d.total / grandTotal) * 10000) / 100 : 0, ""
    ]);
  });
  rows.push([]);

  // Section 5: Non rendu
  if (driversWithNR.length > 0) {
    rows.push(["⚠ NON RENDU", "", "", "", "", "", "", ""]);
    rows.push(["", "Chauffeur", "Montant non rendu", "", "", "", "", ""]);
    driversWithNR.sort((a, b) => b.nr - a.nr).forEach((d) => {
      rows.push(["", d.name, d.nr, "", "", "", "", ""]);
    });
    rows.push([]);
  }

  // Section 6: Meilleur / pire jour
  const bestDay = perDay.reduce((a, b) => b.total > a.total ? b : a, perDay[0]);
  const activeDays = perDay.filter(d => d.total > 0);
  const worstDay = activeDays.length > 0
    ? activeDays.reduce((a, b) => b.total < a.total ? b : a, activeDays[0])
    : { day: 0, total: 0 };
  const avgDay = activeDays.length > 0 ? Math.round(activeDays.reduce((s, d) => s + d.total, 0) / activeDays.length) : 0;

  rows.push(["ANALYSE PAR JOUR", "", "", "", "", "", "", ""]);
  rows.push(["", "Meilleur jour", bestDay ? `Jour ${bestDay.day}` : "-", bestDay?.total || 0, "", "", "", ""]);
  rows.push(["", "Jour le plus faible", worstDay.day ? `Jour ${worstDay.day}` : "-", worstDay.total, "", "", "", ""]);
  rows.push(["", "Moyenne / jour actif", "", avgDay, "", "", "", ""]);

  const sheet = XLSX.utils.aoa_to_sheet([]);
  addSheetHeader(sheet, `Tableau de bord — ${monthLabel}`, DASH_COLS);
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: { r: HEADER_ROWS, c: 0 } });

  // Set column widths
  sheet["!cols"] = [
    { wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 4 }
  ];

  XLSX.utils.book_append_sheet(wb, sheet, "Tableau de bord");
}

