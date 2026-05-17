import { describe, it, expect } from "vitest";
import { getCellKey, getDaysInMonth, CATEGORIES } from "@/lib/types";
import type { MonthData } from "@/lib/types";

/**
 * Pure calculation functions extracted from StatsPanel and Dashboard logic
 * for isolated testing without React components.
 */

function computeStatsByLine(data: MonthData, drivers: string[]): { name: string; especes: number; cb: number; total: number }[] {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  return CATEGORIES.map((cat) => {
    let especes = 0, cb = 0;
    const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})]));
    allDrivers.forEach((driver) => {
      const dd = data.drivers[driver];
      if (!dd) return;
      for (let d = 1; d <= daysInMonth; d++) {
        especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
        cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
      }
    });
    return { name: cat, especes: Math.round(especes * 100) / 100, cb: Math.round(cb * 100) / 100, total: Math.round((especes + cb) * 100) / 100 };
  });
}

function computeStatsByDriver(data: MonthData, drivers: string[]): { name: string; especes: number; cb: number; total: number }[] {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})]));
  return allDrivers.map((driver) => {
    let especes = 0, cb = 0;
    const dd = data.drivers[driver];
    if (dd) {
      for (let d = 1; d <= daysInMonth; d++) {
        CATEGORIES.forEach((cat) => {
          especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
        });
      }
    }
    return { name: driver, especes: Math.round(especes * 100) / 100, cb: Math.round(cb * 100) / 100, total: Math.round((especes + cb) * 100) / 100 };
  }).filter((d) => d.total > 0).sort((a, b) => b.total - a.total);
}

function computeStatsByDay(data: MonthData, drivers: string[]): { name: string; especes: number; cb: number; total: number }[] {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})]));
  return Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
    let especes = 0, cb = 0;
    allDrivers.forEach((driver) => {
      const dd = data.drivers[driver];
      if (!dd) return;
      CATEGORIES.forEach((cat) => {
        especes += dd.days[day]?.[getCellKey(cat, "especes")] || 0;
        cb += dd.days[day]?.[getCellKey(cat, "cb")] || 0;
      });
    });
    return { name: `${day}`, especes: Math.round(especes * 100) / 100, cb: Math.round(cb * 100) / 100, total: Math.round((especes + cb) * 100) / 100 };
  });
}

function computePaymentSplit(data: MonthData, drivers: string[]): { name: string; value: number }[] {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})]));
  let especes = 0, cb = 0;
  allDrivers.forEach((driver) => {
    const dd = data.drivers[driver];
    if (!dd) return;
    for (let d = 1; d <= daysInMonth; d++) {
      CATEGORIES.forEach((cat) => {
        especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
        cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
      });
    }
  });
  return [
    { name: "Espèces", value: Math.round(especes * 100) / 100 },
    { name: "CB", value: Math.round(cb * 100) / 100 },
  ];
}

function makeTestData(): MonthData {
  return {
    year: 2026,
    month: 0,
    drivers: {
      BOREL: {
        days: {
          1: { [getCellKey("704", "especes")]: 100, [getCellKey("704", "cb")]: 50 },
          2: { [getCellKey("705", "especes")]: 200 },
        },
        notReturned: { "1_704_especes": true },
      },
      DUPONT: {
        days: {
          1: { [getCellKey("707", "cb")]: 300 },
          15: { [getCellKey("Scolaires", "especes")]: 150 },
        },
      },
    },
    days: {},
  };
}

describe("computeStatsByLine", () => {
  it("calcule les totaux par catégorie correctement", () => {
    const data = makeTestData();
    const result = computeStatsByLine(data, ["BOREL", "DUPONT"]);

    const ligne704 = result.find((r) => r.name === "704")!;
    expect(ligne704.especes).toBe(100);
    expect(ligne704.cb).toBe(50);
    expect(ligne704.total).toBe(150);

    const ligne705 = result.find((r) => r.name === "705")!;
    expect(ligne705.especes).toBe(200);
    expect(ligne705.cb).toBe(0);
    expect(ligne705.total).toBe(200);

    const ligne707 = result.find((r) => r.name === "707")!;
    expect(ligne707.especes).toBe(0);
    expect(ligne707.cb).toBe(300);
    expect(ligne707.total).toBe(300);

    const scolaires = result.find((r) => r.name === "Scolaires")!;
    expect(scolaires.especes).toBe(150);
    expect(scolaires.cb).toBe(0);
    expect(scolaires.total).toBe(150);
  });

  it("retourne 0 pour toutes les catégories si pas de données", () => {
    const empty: MonthData = { year: 2026, month: 0, drivers: {}, days: {} };
    const result = computeStatsByLine(empty, []);
    expect(result.length).toBe(6);
    result.forEach((r) => expect(r.total).toBe(0));
  });
});

describe("computeStatsByDriver", () => {
  it("calcule les totaux par chauffeur correctement", () => {
    const data = makeTestData();
    const result = computeStatsByDriver(data, ["BOREL", "DUPONT"]);

    const boral = result.find((r) => r.name === "BOREL")!;
    expect(boral.especes).toBe(300); // 100 (704) + 200 (705)
    expect(boral.cb).toBe(50);
    expect(boral.total).toBe(350);

    const dupont = result.find((r) => r.name === "DUPONT")!;
    expect(dupont.especes).toBe(150);
    expect(dupont.cb).toBe(300);
    expect(dupont.total).toBe(450);
  });

  it("exclut les chauffeurs avec total = 0", () => {
    const data = makeTestData();
    data.drivers["INACTIF"] = { days: {} };
    const result = computeStatsByDriver(data, ["BOREL", "DUPONT", "INACTIF"]);
    const inactif = result.find((r) => r.name === "INACTIF");
    expect(inactif).toBeUndefined();
  });

  it("trie par total décroissant", () => {
    const data = makeTestData();
    const result = computeStatsByDriver(data, ["BOREL", "DUPONT"]);
    expect(result[0].total).toBeGreaterThanOrEqual(result[1].total);
  });
});

describe("computeStatsByDay", () => {
  it("calcule les totaux par jour", () => {
    const data = makeTestData(); // Janvier = 31 jours
    const result = computeStatsByDay(data, ["BOREL", "DUPONT"]);

    const day1 = result[0];
    expect(day1.name).toBe("1");
    expect(day1.especes).toBe(100); // BOREL 100 espèces 704
    expect(day1.cb).toBe(350); // BOREL 50 + DUPONT 300
    expect(day1.total).toBe(450);

    const day2 = result[1];
    expect(day2.name).toBe("2");
    expect(day2.especes).toBe(200);
    expect(day2.cb).toBe(0);
    expect(day2.total).toBe(200);

    const day15 = result[14];
    expect(day15.especes).toBe(150);
    expect(day15.total).toBe(150);
  });

  it("retourne tous les jours même avec peu de données", () => {
    const data = makeTestData();
    const result = computeStatsByDay(data, ["BOREL", "DUPONT"]);
    expect(result.length).toBe(31); // Janvier
  });
});

describe("computePaymentSplit", () => {
  it("calcule la répartition espèces/CB", () => {
    const data = makeTestData();
    const result = computePaymentSplit(data, ["BOREL", "DUPONT"]);
    
    const especes = result.find((r) => r.name === "Espèces")!;
    const cb = result.find((r) => r.name === "CB")!;

    // BOREL: 100 (704 esp) + 200 (705 esp) = 300 ; DUPONT: 150 (Scolaires esp) = 150 => Total esp = 450
    // BOREL: 50 (704 cb) ; DUPONT: 300 (707 cb) => Total CB = 350
    expect(especes.value).toBe(450);
    expect(cb.value).toBe(350);
  });

  it("retourne 0 pour les deux si pas de données", () => {
    const empty: MonthData = { year: 2026, month: 0, drivers: {}, days: {} };
    const result = computePaymentSplit(empty, []);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(0);
  });
});

describe("getSaveFileName", () => {
  it("génère le bon nom de fichier", async () => {
    // Test via l'export backup
    const { getSaveFileName } = await import("@/lib/backup");
    const name = getSaveFileName({ year: 2026, month: 0, drivers: {}, days: {} });
    expect(name).toContain("Janvier");
    expect(name).toContain("2026");
    expect(name).toContain("Chateaurenard");
    expect(name).toMatch(/\.xlsx$/);
  });
});