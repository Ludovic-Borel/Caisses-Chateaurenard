import { describe, it, expect } from "vitest";
import { buildWorkbook, getLastSaveLocation } from "@/lib/export";
import * as XLSX from "xlsx";
import { getCellKey } from "@/lib/types";
import type { MonthData } from "@/lib/types";

function makeTestMonth(overrides?: Partial<MonthData>): MonthData {
  return {
    year: 2026,
    month: 0, // Janvier
    drivers: {},
    days: {},
    ...overrides,
  };
}

describe("buildWorkbook", () => {
  it("crée un classeur Excel avec les feuilles attendues", () => {
    const data = makeTestMonth();
    const wb = buildWorkbook(data, ["BOREL", "DUPONT"]);
    expect(wb.SheetNames).toContain("Tableau de bord");
    expect(wb.SheetNames).toContain("Récapitulatif");
    expect(wb.SheetNames).toContain("BOREL");
    expect(wb.SheetNames).toContain("DUPONT");
  });

  it("inclut les totaux dans le récapitulatif", () => {
    const data = makeTestMonth({
      drivers: {
        BOREL: {
          days: {
            1: { [getCellKey("704", "especes")]: 100, [getCellKey("704", "cb")]: 50 },
          },
        },
      },
    });
    const wb = buildWorkbook(data, ["BOREL"]);
    const recapSheet = wb.Sheets["Récapitulatif"];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(recapSheet, { header: 1, defval: null });

    // Find the row with "BOREL"
    const boralRow = aoa.find((row) => row[0] === "BOREL");
    expect(boralRow).toBeDefined();

    // Calculate expected: 6 categories x 2 payment types = 12 data columns + driver name + 4 total columns
    // Total Espèces column index: 1 + 12 = 13
    // Total CB: 14, Total Général: 15, Non rendu: 16
    if (boralRow) {
      // Sum all espèces columns for BOREL
      const cats = ["704", "705", "707", "708", "915", "Scolaires"];
      let totalEsp = 0, totalCB = 0;
      cats.forEach((cat, idx) => {
        totalEsp += (boralRow[1 + idx * 2] as number) || 0;
        totalCB += (boralRow[1 + idx * 2 + 1] as number) || 0;
      });
      // Total Espèces should be 100 (only 704_especes)
      // Total CB should be 50 (only 704_cb)
      const totalEspecesCol = boralRow[13] as number;
      const totalCBCol = boralRow[14] as number;
      const totalGeneralCol = boralRow[15] as number;
      expect(totalEspecesCol).toBe(100);
      expect(totalCBCol).toBe(50);
      expect(totalGeneralCol).toBe(150);
    }
  });

  it("gère les non-rendus dans l'export", () => {
    const data = makeTestMonth({
      drivers: {
        BOREL: {
          days: { 1: { [getCellKey("704", "especes")]: 100 } },
          notReturned: { "1_704_especes": true },
        },
      },
    });
    const wb = buildWorkbook(data, ["BOREL"]);
    const recapSheet = wb.Sheets["Récapitulatif"];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(recapSheet, { header: 1, defval: null });
    const boralRow = aoa.find((row) => row[0] === "BOREL");
    // Non rendu column is index 16 (after driver name + 12 cat columns + Esp + CB + Total)
    if (boralRow) {
      const nonRenduCol = boralRow[16] as number;
      expect(nonRenduCol).toBe(100);
    }
  });

  it("gère les chauffeurs sans données", () => {
    const data = makeTestMonth();
    const wb = buildWorkbook(data, ["BOREL", "DUPONT"]);
    const sheet = wb.Sheets["BOREL"];
    expect(sheet).toBeDefined();
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    // Should have header rows (lines 0-2) and day rows (lines 3+)
    expect(aoa.length).toBeGreaterThan(3);
    // All days should be 0 or null for driver without data
  });

  it("limite les noms de feuilles à 31 caractères", () => {
    const data = makeTestMonth();
    const longName = "A".repeat(50);
    const wb = buildWorkbook(data, [longName]);
    const sheetName = wb.SheetNames.find((s: string) => s.includes("A"));
    expect(sheetName).toBeDefined();
    if (sheetName) expect(sheetName.length).toBeLessThanOrEqual(31);
  });

  it("inclut les données pour tous les jours du mois", () => {
    const data = makeTestMonth({
      drivers: {
        BOREL: {
          days: {
            1: { [getCellKey("704", "especes")]: 10 },
            15: { [getCellKey("707", "cb")]: 20 },
            31: { [getCellKey("Scolaires", "especes")]: 30 },
          },
        },
      },
    });
    const wb = buildWorkbook(data, ["BOREL"]);
    const sheet = wb.Sheets["BOREL"];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

    // day 1, 15, 31 should have data
    const day1Row = aoa.find((row: unknown[]) => row[0] === 1);
    const day15Row = aoa.find((row: unknown[]) => row[0] === 15);
    const day31Row = aoa.find((row: unknown[]) => row[0] === 31);

    expect(day1Row).toBeDefined();
    expect(day15Row).toBeDefined();
    expect(day31Row).toBeDefined();
  });
});

describe("getLastSaveLocation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retourne null quand rien n'est sauvegardé", () => {
    expect(getLastSaveLocation()).toBeNull();
  });

  it("retourne la valeur sauvegardée", () => {
    localStorage.setItem("recettes_save_dir_handle", "MonDossier");
    expect(getLastSaveLocation()).toBe("MonDossier");
  });
});