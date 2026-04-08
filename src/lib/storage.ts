import { MonthData, SavedMonth, DEFAULT_DRIVERS } from "./types";

const MONTH_KEY_PREFIX = "recettes_month_";

function monthKey(year: number, month: number): string {
  return `${MONTH_KEY_PREFIX}${year}_${month}`;
}

export function loadMonth(year: number, month: number): MonthData | null {
  const raw = localStorage.getItem(monthKey(year, month));
  return raw ? JSON.parse(raw) : null;
}

export function saveMonth(data: MonthData): void {
  localStorage.setItem(monthKey(data.year, data.month), JSON.stringify(data));
}

export function archiveMonth(data: MonthData): void {
  const archives = loadArchives();
  const entry: SavedMonth = {
    id: `${data.year}-${data.month}-${Date.now()}`,
    year: data.year,
    month: data.month,
    data,
    savedAt: new Date().toISOString(),
  };
  const filtered = archives.filter(
    (a) => !(a.year === data.year && a.month === data.month)
  );
  filtered.push(entry);
  filtered.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(filtered));
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
