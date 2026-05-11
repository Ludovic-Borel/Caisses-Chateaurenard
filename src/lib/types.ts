export const CATEGORIES = ["704", "705", "707", "708", "915", "Scolaires"] as const;
export type Category = typeof CATEGORIES[number];
export const PAYMENT_TYPES = ["especes", "cb"] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

export interface DayEntry {
  [key: string]: number; // key = `${category}_${paymentType}`
}

// Per-driver monthly data
export interface DriverMonthData {
  days: Record<number, DayEntry>; // day 1-31
  notReturned?: Record<string, boolean>; // key = `${day}_${category}_${paymentType}`
  extracts?: Record<number, DayEntry>; // day -> extract entries (keys = `${category}_${paymentType}`)
}

// Full month with all drivers
export interface MonthData {
  year: number;
  month: number; // 0-11
  drivers: Record<string, DriverMonthData>;
  // Global "récap" grid kept for backward compat
  days: Record<number, DayEntry>;
}

export interface SavedMonth {
  id: string;
  year: number;
  month: number;
  data: MonthData;
  savedAt: string;
}

export function getCellKey(category: Category, paymentType: PaymentType): string {
  return `${category}_${paymentType}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export const DEFAULT_DRIVERS = [
  "ABBADI", "ABOUBAKAR", "ALKAMA", "ARKOUS", "AJHIOU", "BEC", "BELHAJ",
  "BENRAHOU", "BENZEROUK", "BERNARAS", "BOREL", "CALATAYUD", "CAMPOS",
  "CHAKOR", "CHAMANIER", "CHAMBRON", "CHAROUITE", "CHAVOUTIER", "CHOUANE",
  "DJAHMI", "DRID", "EL BADRI", "ESPOSITO", "FARE", "FATIHI", "FILIPE",
  "GHRIB", "GILLES", "GOZIN", "GUILLOT", "HAJJI", "ISOARDO", "JUAN",
  "LACOMBE", "LE BIGOT", "MHAYA M", "MHAYA N", "MACHABERT", "MAFFEI",
  "MANFRINI", "MARCON", "MARTINEZ", "MEYER", "MSELLI", "PALOMARES",
  "PANAROTTO", "PREAUX A", "RAKOTO", "RASCOL", "REY J", "REY M", "REY T",
  "ROLLAND", "STANGHELLINI", "TANNOUCH", "THOMASSIN"
];
