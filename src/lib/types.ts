export const CATEGORIES = ["704", "705", "707", "708", "915", "Scolaires"] as const;
export type Category = typeof CATEGORIES[number];
export const PAYMENT_TYPES = ["especes", "cb"] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

export interface DayEntry {
  [key: string]: number; // key = `${category}_${paymentType}`
}

export interface MonthData {
  year: number;
  month: number; // 0-11
  days: Record<number, DayEntry>; // day 1-31
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
