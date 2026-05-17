import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  PAYMENT_TYPES,
  getCellKey,
  getDaysInMonth,
  MONTH_NAMES,
  DEFAULT_DRIVERS,
  type Category,
  type PaymentType,
  type MonthData,
  type DriverMonthData,
  type DayEntry,
} from "@/lib/types";

describe("Constants", () => {
  it("CATEGORIES contient les 6 lignes attendues", () => {
    expect(CATEGORIES).toEqual(["704", "705", "707", "708", "915", "Scolaires"]);
    expect(CATEGORIES.length).toBe(6);
  });

  it("PAYMENT_TYPES contient espèces et cb", () => {
    expect(PAYMENT_TYPES).toEqual(["especes", "cb"]);
  });

  it("MONTH_NAMES contient 12 mois en français", () => {
    expect(MONTH_NAMES.length).toBe(12);
    expect(MONTH_NAMES[0]).toBe("Janvier");
    expect(MONTH_NAMES[11]).toBe("Décembre");
  });

  it("DEFAULT_DRIVERS est un tableau non vide de noms en majuscules", () => {
    expect(Array.isArray(DEFAULT_DRIVERS)).toBe(true);
    expect(DEFAULT_DRIVERS.length).toBeGreaterThan(50);
    DEFAULT_DRIVERS.forEach((name) => {
      expect(name).toEqual(name.toUpperCase());
    });
  });
});

describe("getCellKey", () => {
  it("génère une clé au format category_paymenttype", () => {
    expect(getCellKey("704", "especes")).toBe("704_especes");
    expect(getCellKey("Scolaires", "cb")).toBe("Scolaires_cb");
  });

  it("accepte tous les CATEGORIES et PAYMENT_TYPES", () => {
    for (const cat of CATEGORIES) {
      for (const pt of PAYMENT_TYPES) {
        const key = getCellKey(cat, pt);
        expect(key).toMatch(/^.+/);
        expect(key).toContain("_");
      }
    }
  });
});

describe("getDaysInMonth", () => {
  it("retourne 31 pour janvier", () => {
    expect(getDaysInMonth(2026, 0)).toBe(31);
  });

  it("retourne 28 pour février 2026 (non bissextile)", () => {
    expect(getDaysInMonth(2026, 1)).toBe(28);
  });

  it("retourne 29 pour février 2024 (bissextile)", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it("retourne 30 pour avril", () => {
    expect(getDaysInMonth(2026, 3)).toBe(30);
  });

  it("retourne 31 pour décembre", () => {
    expect(getDaysInMonth(2026, 11)).toBe(31);
  });
});

describe("Interfaces structure", () => {
  it("MonthData a la bonne structure", () => {
    const data: MonthData = {
      year: 2026,
      month: 0,
      drivers: {},
      days: {},
    };
    expect(data.year).toBe(2026);
    expect(data.month).toBe(0);
    expect(typeof data.drivers).toBe("object");
    expect(typeof data.days).toBe("object");
  });

  it("DriverMonthData accepte days, notReturned et extracts", () => {
    const dd: DriverMonthData = {
      days: { 1: { "704_especes": 100, "704_cb": 50 } },
      notReturned: { "1_704_especes": true },
      extracts: { 1: { "704_especes": 100 } },
    };
    expect(dd.days[1]["704_especes"]).toBe(100);
    expect(dd.notReturned!["1_704_especes"]).toBe(true);
    expect(dd.extracts![1]["704_especes"]).toBe(100);
  });

  it("DayEntry stocke des nombres", () => {
    const entry: DayEntry = {
      "704_especes": 150.5,
      "704_cb": 75.25,
      "Scolaires_especes": 0,
    };
    expect(entry["704_especes"]).toBe(150.5);
    expect(entry["704_cb"]).toBe(75.25);
    expect(entry["Scolaires_especes"]).toBe(0);
  });
});

describe("Edge cases", () => {
  it("getCellKey gère les cas spéciaux de noms de catégories", () => {
    expect(getCellKey("Scolaires", "especes")).toBe("Scolaires_especes");
    expect(getCellKey("915", "cb")).toBe("915_cb");
  });

  it("getDaysInMonth gère les limites (année 0 et année 9999)", () => {
    expect(getDaysInMonth(0, 0)).toBe(31);   // Janvier an 0
    expect(getDaysInMonth(9999, 11)).toBe(31); // Décembre 9999
  });

  it("getDaysInMonth est cohérent pour tous les mois d'une année standard", () => {
    const expected = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 0; m < 12; m++) {
      expect(getDaysInMonth(2025, m)).toBe(expected[m]);
    }
  });

  it("DEFAULT_DRIVERS ne contient pas de doublons", () => {
    const set = new Set(DEFAULT_DRIVERS);
    expect(set.size).toBe(DEFAULT_DRIVERS.length);
  });
});