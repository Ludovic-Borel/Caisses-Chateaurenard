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
export async function enableRealtime(): Promise<boolean> {
  if (realtimeEnabled) return true;
  realtimeEnabled = true;

  let monthOk = false;
  let driversOk = false;

  // Subscribe to months table changes
  const monthSub = supabase
    .channel("months-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "months" },
      (payload: RealtimePostgresChangesPayload<any>) => {
        handleMonthChange(payload);
      }
    )
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.log("[Supabase] Realtime months channel connected");
        monthOk = true;
      } else if (status === "CHANNEL_ERROR") {
        console.warn("[Supabase] Realtime months channel error");
      }
    });

  // Subscribe to drivers table changes
  const driversSub = supabase
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
        console.log("[Supabase] Realtime drivers channel connected");
        driversOk = true;
      } else if (status === "CHANNEL_ERROR") {
        console.warn("[Supabase] Realtime drivers channel error");
      }
    });

  // Wait a moment for subscriptions to connect
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return monthOk && driversOk;
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
  if (payload.new && (payload.new as any).id === 1) {
    const row = payload.new as any;
    const names = typeof row.names === "string" ? JSON.parse(row.names) : row.names;
    if (Array.isArray(names)) {
      setLocalDrivers(names as string[]);
      driversCallbacks.forEach((cb) => cb(names as string[]));
    }
  }
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

// ---------- Check connection ----------
export interface SupabaseStatus {
  connected: boolean;
  monthsTable: boolean;
  driversTable: boolean;
  driversCount: number;
  monthsCount: number;
  error: string | null;
}

export async function checkSupabaseStatus(): Promise<SupabaseStatus> {
  const status: SupabaseStatus = {
    connected: false,
    monthsTable: false,
    driversTable: false,
    driversCount: 0,
    monthsCount: 0,
    error: null,
  };

  try {
    // Check if we can reach Supabase at all
    const { error: pingErr } = await supabase.from("months").select("id").limit(1);
    if (pingErr) {
      status.error = `Erreur table months: ${pingErr.message} (code: ${pingErr.code})`;
      return status;
    }
    status.connected = true;
    status.monthsTable = true;

    // Count months
    const { count: monthCount, error: monthCountErr } = await supabase
      .from("months")
      .select("id", { count: "exact", head: true });
    if (!monthCountErr && monthCount !== null) {
      status.monthsCount = monthCount;
    }

    // Check drivers table
    const { data: driverData, error: driverErr } = await supabase
      .from("drivers")
      .select("names")
      .eq("id", 1)
      .single();
    if (driverErr) {
      status.error = `Erreur table drivers: ${driverErr.message} (code: ${driverErr.code})`;
      return status;
    }
    status.driversTable = true;
    if (driverData && Array.isArray(driverData.names)) {
      status.driversCount = driverData.names.length;
    }
  } catch (e: any) {
    status.error = `Exception: ${e?.message || String(e)}`;
  }

  return status;
}

// ---------- Drivers ----------
export async function loadDrivers(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("drivers")
      .select("names")
      .eq("id", 1)
      .single();

    if (error) throw error;

    const names = data.names;
    if (Array.isArray(names)) {
      // Overwrite localStorage with server data (force sync)
      setLocalDrivers(names as string[]);
      return names as string[];
    }
  } catch (e) {
    console.warn("Supabase loadDrivers failed, using localStorage:", e);
  }

  return getLocalDrivers();
}

export async function saveDrivers(drivers: string[]): Promise<{ ok: boolean; error?: string }> {
  // Always save locally first
  setLocalDrivers(drivers);

  try {
    const { error } = await supabase
      .from("drivers")
      .upsert({ id: 1, names: drivers }, { onConflict: "id" });

    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.warn("Supabase saveDrivers failed, saved locally:", msg);
    return { ok: false, error: msg };
  }
}

export function renameDriverRemote(_oldName: string, _newName: string): void {
  // No-op: driver rename handled locally + synced via saveDrivers
}

// ---------- Month data ----------
export async function loadMonth(year: number, month: number): Promise<MonthData | null> {
  // Always try Supabase first
  try {
    const { data, error } = await supabase
      .from("months")
      .select("data")
      .eq("year", year)
      .eq("month", month)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found - normal, month doesn't exist yet
        // Clear any stale localStorage entry
        localStorage.removeItem(monthKey(year, month));
        return null;
      }
      throw error;
    }

    if (data?.data) {
      const monthData = data.data as MonthData;
      // Overwrite localStorage with server data (force sync)
      setLocalMonth(monthData);
      return monthData;
    }

    return null;
  } catch (e) {
    console.warn("Supabase loadMonth failed, using localStorage:", e);
    return getLocalMonth(year, month);
  }
}

export async function saveMonth(data: MonthData): Promise<{ ok: boolean; error?: string }> {
  // Always save locally first
  setLocalMonth(data);

  try {
    const { error } = await supabase
      .from("months")
      .upsert(
        {
          year: data.year,
          month: data.month,
          data: data,
        },
        { onConflict: "year, month" }
      );

    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.warn("Supabase saveMonth failed, saved locally:", msg);
    return { ok: false, error: msg };
  }
}

export async function loadAllMonths(): Promise<MonthData[]> {
  const results: MonthData[] = [];

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("months")
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
export interface MigrationResult {
  monthsMigrated: number;
  monthsTotal: number;
  driversMigrated: boolean;
  driversCount: number;
  errors: string[];
}

export async function migrateLocalToRemote(): Promise<MigrationResult> {
  const result: MigrationResult = {
    monthsMigrated: 0,
    monthsTotal: 0,
    driversMigrated: false,
    driversCount: 0,
    errors: [],
  };

  // Migrate months
  const monthKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MONTH_KEY_PREFIX)) {
      monthKeys.push(key);
    }
  }
  result.monthsTotal = monthKeys.length;

  for (const key of monthKeys) {
    try {
      const data: MonthData = JSON.parse(localStorage.getItem(key)!);
      const { error } = await supabase.from("months").upsert(
        { year: data.year, month: data.month, data },
        { onConflict: "year, month" }
      );
      if (error) {
        result.errors.push(`Mois ${key}: ${error.message}`);
      } else {
        result.monthsMigrated++;
      }
    } catch (e: any) {
      result.errors.push(`Mois ${key}: ${e?.message || String(e)}`);
    }
  }

  // Migrate drivers
  const localDrivers = getLocalDrivers();
  result.driversCount = localDrivers.length;
  if (localDrivers.length > 0) {
    try {
      const { error } = await supabase
        .from("drivers")
        .upsert({ id: 1, names: localDrivers }, { onConflict: "id" });

      if (error) {
        result.errors.push(`Drivers: ${error.message}`);
      } else {
        result.driversMigrated = true;
      }
    } catch (e: any) {
      result.errors.push(`Drivers: ${e?.message || String(e)}`);
    }
  }

  return result;
}

// Helpers for loading-by-keys
export const _internal = { monthKey, MONTH_KEY_PREFIX };