import { MonthData, SavedMonth } from "./types";

const CURRENT_KEY = "recettes_current";
const ARCHIVE_KEY = "recettes_archive";

export function loadCurrentMonth(): MonthData | null {
  const raw = localStorage.getItem(CURRENT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveCurrentMonth(data: MonthData): void {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(data));
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
  // Replace existing archive for same month/year
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
