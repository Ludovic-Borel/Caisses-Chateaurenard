import { describe, it, expect } from "vitest";
import { mergeAddOnly, mergeFullReplace } from "@/lib/merge";
import type { MonthData } from "@/lib/types";

function makeMonth(overrides?: Partial<MonthData>): MonthData {
  return {
    year: 2026,
    month: 0,
    drivers: {},
    days: {},
    ...overrides,
  };
}

describe("mergeAddOnly", () => {
  it("ajoute un nouveau chauffeur inconnu", () => {
    const existing = makeMonth();
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 100 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"]).toBeDefined();
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(100);
  });

  it("ne remplace pas les données existantes d'un chauffeur", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 200 } } },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 50 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(200);
  });

  it("remplit les cellules vides (0 ou undefined)", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 100 } } },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_cb": 50 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(100);
    expect(result.drivers["BOREL"].days[1]["704_cb"]).toBe(50);
  });

  it("fusionne les notReturned (garde existant, ajoute nouveau)", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: {
          days: { 1: { "704_especes": 100 } },
          notReturned: { "1_704_especes": true },
        },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: {
          days: { 2: { "704_cb": 50 } },
          notReturned: { "2_704_cb": true },
        },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].notReturned!["1_704_especes"]).toBe(true);
    expect(result.drivers["BOREL"].notReturned!["2_704_cb"]).toBe(true);
  });

  it("fusionne les extracts (garde existant, ajoute nouveau)", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: {
          days: { 1: { "704_especes": 100 } },
          extracts: { 1: { "704_especes": 100 } },
        },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: {
          days: { 2: { "704_cb": 50 } },
          extracts: { 2: { "704_cb": 50 } },
        },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].extracts![1]["704_especes"]).toBe(100);
    expect(result.drivers["BOREL"].extracts![2]["704_cb"]).toBe(50);
  });

  it("fusionne les global days (add only)", () => {
    const existing = makeMonth({ days: { 1: { "704_especes": 100 } } });
    const incoming = makeMonth({ days: { 2: { "704_cb": 50 } } });
    const result = mergeAddOnly(existing, incoming);
    expect(result.days[1]["704_especes"]).toBe(100);
    expect(result.days[2]["704_cb"]).toBe(50);
  });

  it("fusionne plusieurs chauffeurs simultanément", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 100 } } },
      },
    });
    const incoming = makeMonth({
      drivers: {
        DUPONT: { days: { 1: { "705_cb": 200 } } },
        MARTIN: { days: { 2: { "707_especes": 300 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(100);
    expect(result.drivers["DUPONT"].days[1]["705_cb"]).toBe(200);
    expect(result.drivers["MARTIN"].days[2]["707_especes"]).toBe(300);
  });
});

describe("mergeFullReplace", () => {
  it("remplace les données d'un chauffeur existant", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 100 } } },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 999 } } },
      },
    });
    const result = mergeFullReplace(existing, incoming);
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(999);
  });

  it("ajoute un nouveau chauffeur", () => {
    const existing = makeMonth({ drivers: { BOREL: { days: { 1: { "704_especes": 100 } } } } });
    const incoming = makeMonth({ drivers: { DUPONT: { days: { 2: { "705_cb": 200 } } } } });
    const result = mergeFullReplace(existing, incoming);
    expect(result.drivers["BOREL"]).toBeDefined();
    expect(result.drivers["DUPONT"]).toBeDefined();
  });

  it("remplace les global days", () => {
    const existing = makeMonth({ days: { 1: { "704_especes": 100 } } });
    const incoming = makeMonth({ days: { 1: { "704_especes": 999 } } });
    const result = mergeFullReplace(existing, incoming);
    expect(result.days[1]["704_especes"]).toBe(999);
  });

  it("gère l'input vide correctement", () => {
    const existing = makeMonth({ drivers: { BOREL: { days: { 1: { "704_especes": 100 } } } } });
    const result = mergeFullReplace(existing, makeMonth());
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(100);
  });
});

describe("mergeAddOnly - edge cases", () => {
  it("gère existing.days vide pour un chauffeur existant", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: { days: {} },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 100 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(100);
  });

  it("préserve les extraits existants quand incoming n'a pas d'extracts", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: {
          days: { 1: { "704_especes": 100 } },
          extracts: { 1: { "704_especes": 100 } },
        },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 2: { "704_cb": 50 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].extracts![1]["704_especes"]).toBe(100);
  });

  it("ne crée pas notReturned si vide", () => {
    const existing = makeMonth({ drivers: { BOREL: { days: {} } } });
    const incoming = makeMonth({ drivers: { BOREL: { days: { 1: { "704_especes": 100 } } } } });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].notReturned).toBeUndefined();
  });

  it("ne crée pas extracts si vide", () => {
    const existing = makeMonth({ drivers: { BOREL: { days: {} } } });
    const incoming = makeMonth({ drivers: { BOREL: { days: { 1: { "704_especes": 100 } } } } });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].extracts).toBeUndefined();
  });

  it("gère le merge de jours différents pour un même chauffeur", () => {
    const existing = makeMonth({
      drivers: {
        BOREL: { days: { 1: { "704_especes": 100 }, 3: { "704_cb": 75 } } },
      },
    });
    const incoming = makeMonth({
      drivers: {
        BOREL: { days: { 2: { "704_especes": 200 }, 4: { "704_cb": 150 } } },
      },
    });
    const result = mergeAddOnly(existing, incoming);
    expect(result.drivers["BOREL"].days[1]["704_especes"]).toBe(100);
    expect(result.drivers["BOREL"].days[2]["704_especes"]).toBe(200);
    expect(result.drivers["BOREL"].days[3]["704_cb"]).toBe(75);
    expect(result.drivers["BOREL"].days[4]["704_cb"]).toBe(150);
  });
});