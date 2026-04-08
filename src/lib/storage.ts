import { MonthData, SavedMonth, DEFAULT_DRIVERS } from "./types";

const MONTH_KEY_PREFIX = "recettes_month_";
const ARCHIVE_KEY = "recettes_archive_v2";
const DRIVERS_KEY = "recettes_drivers";

function monthKey(year: number, month: number): string {
  return `${MONTH_KEY_PREFIX}${year}_${month}`;
}

export function loadDrivers(): string[] {
  const raw = localStorage.getItem(DRIVERS_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_DRIVERS;
}

export function saveDrivers(drivers: string[]): void {
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
}

export function loadMonth(year: number, month: number): MonthData | null {
  const raw = localStorage.getItem(monthKey(year, month));
  return raw ? JSON.parse(raw) : null;
}

export function saveMonth(data: MonthData): void {
  localStorage.setItem(monthKey(data.year, data.month), JSON.stringify(data));
}

export function loadArchives(): SavedMonth[] {
  const raw = localStorage.getItem(ARCHIVE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function deleteArchive(id: string): void {
  const archives = loadArchives().filter((a) => a.id !== id);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives));
}

export function updateArchive(id: string, data: MonthData): void {
  const archives = loadArchives().map((a) =>
    a.id === id ? { ...a, data, savedAt: new Date().toISOString() } : a
  );
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives));
}
