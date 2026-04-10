import { MonthData, DEFAULT_DRIVERS } from "./types";

const MONTH_KEY_PREFIX = "recettes_month_";
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

export function loadAllMonths(): MonthData[] {
  const results: MonthData[] = [];
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
