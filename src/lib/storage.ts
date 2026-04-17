import { MonthData, DEFAULT_DRIVERS } from "./types";
import { supabase } from "@/integrations/supabase/client";

const MONTH_KEY_PREFIX = "recettes_month_";
const DRIVERS_KEY = "recettes_drivers";

function monthKey(year: number, month: number): string {
  return `${MONTH_KEY_PREFIX}${year}_${month}`;
}

// ---------- LocalStorage fallback ----------
function lsLoadDrivers(): string[] {
  const raw = localStorage.getItem(DRIVERS_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_DRIVERS;
}
function lsSaveDrivers(drivers: string[]): void {
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
}
function lsLoadMonth(year: number, month: number): MonthData | null {
  const raw = localStorage.getItem(monthKey(year, month));
  return raw ? JSON.parse(raw) : null;
}
function lsSaveMonth(data: MonthData): void {
  localStorage.setItem(monthKey(data.year, data.month), JSON.stringify(data));
}

// ---------- Supabase-backed API ----------
export async function loadDrivers(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from("drivers").select("name").order("name");
    if (error) throw error;
    if (!data || data.length === 0) {
      // Seed defaults
      await supabase.from("drivers").insert(DEFAULT_DRIVERS.map((name) => ({ name })));
      lsSaveDrivers(DEFAULT_DRIVERS);
      return [...DEFAULT_DRIVERS].sort();
    }
    const names = data.map((d: { name: string }) => d.name).sort();
    lsSaveDrivers(names);
    return names;
  } catch (e) {
    console.warn("loadDrivers fallback to localStorage", e);
    return lsLoadDrivers();
  }
}

export async function saveDrivers(drivers: string[]): Promise<void> {
  lsSaveDrivers(drivers);
  try {
    const { data: existing, error } = await supabase.from("drivers").select("name");
    if (error) throw error;
    const existingNames = new Set((existing ?? []).map((d: { name: string }) => d.name));
    const newSet = new Set(drivers);
    const toInsert = drivers.filter((n) => !existingNames.has(n)).map((name) => ({ name }));
    const toDelete = [...existingNames].filter((n) => !newSet.has(n));
    if (toInsert.length) await supabase.from("drivers").insert(toInsert);
    if (toDelete.length) await supabase.from("drivers").delete().in("name", toDelete);
  } catch (e) {
    console.warn("saveDrivers failed", e);
  }
}

export async function renameDriverRemote(oldName: string, newName: string): Promise<void> {
  try {
    await supabase.from("drivers").update({ name: newName }).eq("name", oldName);
  } catch (e) {
    console.warn("renameDriverRemote failed", e);
  }
}

export async function loadMonth(year: number, month: number): Promise<MonthData | null> {
  try {
    const { data, error } = await supabase
      .from("month_data")
      .select("data")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const local = lsLoadMonth(year, month);
      if (local) {
        // Migrate local -> remote
        await saveMonth(local);
        return local;
      }
      return null;
    }
    const md = { year, month, ...(data.data as object) } as MonthData;
    lsSaveMonth(md);
    return md;
  } catch (e) {
    console.warn("loadMonth fallback to localStorage", e);
    return lsLoadMonth(year, month);
  }
}

export async function saveMonth(data: MonthData): Promise<void> {
  lsSaveMonth(data);
  try {
    const { error } = await supabase
      .from("month_data")
      .upsert(
        { year: data.year, month: data.month, data: data as unknown as Record<string, unknown> },
        { onConflict: "year,month" }
      );
    if (error) throw error;
  } catch (e) {
    console.warn("saveMonth failed", e);
  }
}

export async function loadAllMonths(): Promise<MonthData[]> {
  try {
    const { data, error } = await supabase.from("month_data").select("year, month, data");
    if (error) throw error;
    return (data ?? []).map((r: { year: number; month: number; data: unknown }) => ({
      year: r.year,
      month: r.month,
      ...(r.data as object),
    })) as MonthData[];
  } catch (e) {
    console.warn("loadAllMonths fallback to localStorage", e);
    const results: MonthData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MONTH_KEY_PREFIX)) {
        try { results.push(JSON.parse(localStorage.getItem(key)!)); } catch {}
      }
    }
    return results;
  }
}

// One-time migration of localStorage data to Supabase
export async function migrateLocalToRemote(): Promise<void> {
  const flag = "recettes_migrated_v1";
  if (localStorage.getItem(flag)) return;
  try {
    // Drivers
    const localDrivers = localStorage.getItem(DRIVERS_KEY);
    if (localDrivers) {
      const arr: string[] = JSON.parse(localDrivers);
      if (arr.length) {
        const { data: existing } = await supabase.from("drivers").select("name");
        const existingNames = new Set((existing ?? []).map((d: { name: string }) => d.name));
        const toInsert = arr.filter((n) => !existingNames.has(n)).map((name) => ({ name }));
        if (toInsert.length) await supabase.from("drivers").insert(toInsert);
      }
    }
    // Months
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MONTH_KEY_PREFIX)) {
        try {
          const md: MonthData = JSON.parse(localStorage.getItem(key)!);
          await supabase.from("month_data").upsert(
            { year: md.year, month: md.month, data: md as unknown as Record<string, unknown> },
            { onConflict: "year,month" }
          );
        } catch {}
      }
    }
    localStorage.setItem(flag, "1");
  } catch (e) {
    console.warn("migrateLocalToRemote failed", e);
  }
}

// Helpers for loading-by-keys
export const _internal = { monthKey, MONTH_KEY_PREFIX };
