import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MonthData } from "@/lib/types";

// Mock supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),    
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  },
}));

import {
  _internal,
  loadDrivers,
  saveDrivers,
  loadMonth,
  saveMonth,
  loadAllMonths,
  migrateLocalToRemote,
} from "@/lib/storage";
import {
  getBackupDirName,
  getTemplateFileName,
} from "@/lib/backup";

const { monthKey, MONTH_KEY_PREFIX } = _internal;

describe("Storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("monthKey génère le bon préfixe", () => {
    expect(monthKey(2026, 0)).toBe("recettes_month_2026_0");
    expect(monthKey(2026, 11)).toBe("recettes_month_2026_11");
  });

  it("MONTH_KEY_PREFIX est défini", () => {
    expect(MONTH_KEY_PREFIX).toBe("recettes_month_");
  });
});

describe("loadDrivers / saveDrivers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retourne les drivers par défaut si rien en localStorage", async () => {
    const drivers = await loadDrivers();
    expect(Array.isArray(drivers)).toBe(true);
    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers).toContain("BOREL");
  });

  it("sauvegarde et recharge les drivers en localStorage", async () => {
    await saveDrivers(["BOREL", "DUPONT"]);
    const stored = localStorage.getItem("recettes_drivers");
    expect(stored).toBe('["BOREL","DUPONT"]');
  });
});

describe("loadMonth / saveMonth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sauvegarde un mois en localStorage", async () => {
    const monthData: MonthData = {
      year: 2026,
      month: 0,
      drivers: { BOREL: { days: { 1: { "704_especes": 100 } } } },
      days: {},
    };
    await saveMonth(monthData);
    const key = monthKey(2026, 0);
    const stored = localStorage.getItem(key);
    expect(stored).toBeDefined();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(0);
      expect(parsed.drivers.BOREL.days[1]["704_especes"]).toBe(100);
    }
  });

  it("charge un mois inexistant retourne null", async () => {
    const data = await loadMonth(2025, 5);
    expect(data).toBeNull();
  });
});

describe("loadAllMonths", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retourne un tableau vide si aucun mois sauvegardé", async () => {
    const all = await loadAllMonths();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(0);
  });

  it("retourne tous les mois sauvegardés", async () => {
    const m1: MonthData = { year: 2026, month: 0, drivers: {}, days: {} };
    const m2: MonthData = { year: 2026, month: 1, drivers: {}, days: {} };
    await saveMonth(m1);
    await saveMonth(m2);
    const all = await loadAllMonths();
    expect(all.length).toBe(2);
    expect(all.some((m) => m.year === 2026 && m.month === 0)).toBe(true);
    expect(all.some((m) => m.year === 2026 && m.month === 1)).toBe(true);
  });

  it("ignore les clés localStorage non liées aux mois", async () => {
    localStorage.setItem("other_key", "test");
    const m: MonthData = { year: 2026, month: 0, drivers: {}, days: {} };
    await saveMonth(m);
    const all = await loadAllMonths();
    expect(all.length).toBe(1);
  });
});

describe("Backup dir helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getBackupDirName retourne null si non défini", () => {
    expect(getBackupDirName()).toBeNull();
  });

  it("getBackupDirName retourne le nom sauvegardé", () => {
    localStorage.setItem("recettes_backup_dir_name", "MesSauvegardes");
    expect(getBackupDirName()).toBe("MesSauvegardes");
  });
});

describe("Template file helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getTemplateFileName retourne null si non défini", () => {
    expect(getTemplateFileName()).toBeNull();
  });

  it("getTemplateFileName retourne le nom sauvegardé", () => {
    localStorage.setItem("recettes_template_file_name", "Modele.xlsm");
    expect(getTemplateFileName()).toBe("Modele.xlsm");
  });
});

describe("migrateLocalToRemote", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ne plante pas quand localStorage est vide", async () => {
    await expect(migrateLocalToRemote()).resolves.not.toThrow();
  });
});