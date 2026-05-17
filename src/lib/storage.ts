import { MonthData, DEFAULT_DRIVERS } from "./types";
import { supabase } from "./supabase";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const MONTH_KEY_PREFIX = "recettes_month_";
const DRIVERS_KEY = "recettes_drivers";

// ---------- Real-time callback types ----------
type MonthCallback = (data: MonthData) => void;
type DriversCallback = (drivers: string[]) => void;

const monthCallbacks: Map<string, Set<MonthCallback>> = new Map();
const driversCallbacks: Set<DriversCallback> = new Set();

// ---------- Real-time subscription management ----------
let realtimeEnabled = false;

function getMonthKeyId(year: number, month: number): string {
  return `${year}_${month}`;
}

/**
 * Initialize real-time listeners for Supabase changes.
 * Call this once on app startup.
 */
export async function enableRealtime(): Promise<void> {
  if (realtimeEnabled) return;
  realtimeEnabled = true;

  // Subscribe to month_data table changes
  supabase
    .channel("month_data-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "month_data" },
      (payload: RealtimePostgresChangesPayload<any>) => {
        handleMonthChange(payload);
      }
    )
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.log("Realtime: month_data channel connected");
      } else if (status === "CHANNEL_ERROR") {
        console.warn("Realtime: month_data channel error");
      }
    });

  // Subscribe to drivers table changes
  supabase
    .channel("drivers-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "drivers" },
      (payload: RealtimePostgresChangesPayload<any>) => {
        handleDriversChange(payload);
      }
    )
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.log("Realtime: drivers channel connected");
      } else if (status === "CHANNEL_ERROR") {
        console.warn("Realtime: drivers channel error");
      }
    });
}

function handleMonthChange(payload: RealtimePostgresChangesPayload<any>): void {
  if (payload.new && (payload.new as any).year && (payload.new as any).month !== undefined) {
    const row = payload.new as any;
    const key = getMonthKeyId(row.year, row.month);
    const callbacks = monthCallbacks.get(key);
    if (callbacks) {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      callbacks.forEach((cb) => cb(data as MonthData));
    }
  }
}

function handleDriversChange(payload: RealtimePostgresChangesPayload<any>): void {
  // For the new drivers table (each driver is its own row),
  // we just re-load all drivers and notify callbacks
  loadAllDriversRemote().then((names) => {
    if (names) {
      setLocalDrivers(names);
      driversCallbacks.forEach((cb) => cb(names));
    }
  });
}

// ---------- Callback registration ----------

/**
 * Register a callback to be called when month data changes in real-time.
 * Returns an unsubscribe function.
 */
export function onMonthChange(
  year: number,
  month: number,
  callback: MonthCallback
): () => void {
  const key = getMonthKeyId(year, month);
  if (!monthCallbacks.has(key)) {
    monthCallbacks.set(key, new Set());
  }
  monthCallbacks.get(key)!.add(callback);

  return () => {
    monthCallbacks.get(key)?.delete(callback);
    if (monthCallbacks.get(key)?.size === 0) {
      monthCallbacks.delete(key);
    }
  };
}

/**
 * Register a callback to be called when drivers list changes in real-time.
 * Returns an unsubscribe function.
 */
export function onDriversChange(callback: DriversCallback): () => void {
  driversCallbacks.add(callback);
  return () => {
    driversCallbacks.delete(callback);
  };
}

// ---------- Local helpers ----------
function monthKey(year: number, month: number): string {
  return `${MONTH_KEY_PREFIX}${year}_${month}`;
}

// ---------- LocalStorage fallback helpers ----------
function setLocalMonth(data: MonthData): void {
  localStorage.setItem(monthKey(data.year, data.month), JSON.stringify(data));
}

function getLocalMonth(year: number, month: number): MonthData | null {
  const raw = localStorage.getItem(monthKey(year, month));
  return raw ? JSON.parse(raw) : null;
}

function setLocalDrivers(drivers: string[]): void {
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
}

function getLocalDrivers(): string[] {
  const raw = localStorage.getItem(DRIVERS_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_DRIVERS;
}

// ---------- Drivers ----------
/**
 * Load all drivers from the remote drivers table (each driver is its own row).
 */
async function loadAllDriversRemote(): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from("drivers")
      .select("name")
      .order("name", { ascending: true });

    if (error) throw error;

    if (data) {
      return data.map((row: any) => row.name as string);
    }
  } catch (e) {
    console.warn("Supabase loadDrivers failed:", e);
  }
  return null;
}

export async function loadDrivers(): Promise<string[]> {
  const remote = await loadAllDriversRemote();
  if (remote !== null) {
    setLocalDrivers(remote);
    return remote;
  }

  return getLocalDrivers();
}

export async function saveDrivers(drivers: string[]): Promise<void> {
  // Always save locally first
  setLocalDrivers(drivers);

  try {
    // Replace all rows in the drivers table
    // First delete all existing rows
    const { error: deleteError } = await supabase
      .from("drivers")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

    if (deleteError) throw deleteError;

    // Then insert each driver as its own row
    if (drivers.length > 0) {
      const rows = drivers.map((name) => ({ name }));
      const { error: insertError } = await supabase
        .from("drivers")
        .insert(rows);

      if (insertError) throw insertError;
    }
  } catch (e) {
    console.warn("Supabase saveDrivers failed, saved locally:", e);
  }
}

export function renameDriverRemote(_oldName: string, _newName: string): void {
  // No-op: driver rename handled locally + synced via saveDrivers
}

// ---------- Month data ----------
export async function loadMonth(year: number, month: number): Promise<MonthData | null> {
  try {
    const { data, error } = await supabase
      .from("month_data")
      .select("data")
      .eq("year", year)
      .eq("month", month)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found - normal, month doesn't exist yet
        return null;
      }
      throw error;
    }

    if (data?.data) {
      const monthData = data.data as MonthData;
      // Sync back to localStorage for fallback
      setLocalMonth(monthData);
      return monthData;
    }

    return null;
  } catch (e) {
    console.warn("Supabase loadMonth failed, using localStorage:", e);
    return getLocalMonth(year, month);
  }
}

export async function saveMonth(data: MonthData): Promise<void> {
  // Always save locally first
  setLocalMonth(data);

  try {
    const { error } = await supabase
      .from("month_data")
      .upsert(
        {
          year: data.year,
          month: data.month,
          data: data,
        },
        { onConflict: "year, month" }
      );

    if (error) throw error;
  } catch (e) {
    console.warn("Supabase saveMonth failed, saved locally:", e);
  }
}

export async function loadAllMonths(): Promise<MonthData[]> {
  const results: MonthData[] = [];

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("month_data")
      .select("data")
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    if (!error && data) {
      for (const row of data) {
        if (row.data) results.push(row.data as MonthData);
      }
      // Sync back to localStorage
      results.forEach((m) => setLocalMonth(m));
      return results;
    }
  } catch (e) {
    console.warn("Supabase loadAllMonths failed, using localStorage:", e);
  }

  // Fallback: load from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MONTH_KEY_PREFIX)) {
      try {
        results.push(JSON.parse(localStorage.getItem(key)!));
      } catch {}
    }
  }

  return results;
}

// ---------- Migration (local → Supabase) ----------
export async function migrateLocalToRemote(): Promise<void> {
  let migratedCount = 0;

  // Migrate months
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MONTH_KEY_PREFIX)) {
      try {
        const data: MonthData = JSON.parse(localStorage.getItem(key)!);
        const { error } = await supabase.from("month_data").upsert(
          { year: data.year, month: data.month, data },
          { onConflict: "year, month" }
        );
        if (error) {
          console.warn(`Failed to migrate month ${key}:`, error.message);
        } else {
          migratedCount++;
        }
      } catch (e) {
        console.warn(`Failed to migrate month ${key}:`, e);
      }
    }
  }

  // Migrate drivers
  const localDrivers = getLocalDrivers();
  if (localDrivers.length > 0) {
    try {
      // Delete all existing drivers
      await supabase.from("drivers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Insert all local drivers
      const rows = localDrivers.map((name) => ({ name }));
      const { error } = await supabase.from("drivers").insert(rows);
      if (error) {
        console.warn("Failed to migrate drivers:", error.message);
      }
    } catch (e) {
      console.warn("Failed to migrate drivers:", e);
    }
  }

  if (migratedCount > 0) {
    console.log(`Migration complete: ${migratedCount} months synced to Supabase`);
  }
}

// Helpers for loading-by-keys
export const _internal = { monthKey, MONTH_KEY_PREFIX };