export interface YearMonth {
  year: number;
  month: number; // 0 = Jan, 11 = Dec
}

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getTodayLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentYearMonth(d: Date = new Date()): YearMonth {
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
  };
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const totalMonths = ym.year * 12 + ym.month + delta;
  const newYear = Math.floor(totalMonths / 12);
  let newMonth = totalMonths % 12;
  if (newMonth < 0) {
    newMonth += 12;
  }
  return {
    year: newYear,
    month: newMonth,
  };
}

export function formatYearMonth(ym: YearMonth): string {
  return `${MONTH_NAMES_SHORT[ym.month]} ${ym.year}`;
}

export function formatYearMonthFull(ym: YearMonth): string {
  return `${MONTH_NAMES_FULL[ym.month]} ${ym.year}`;
}

export function isDateInYearMonth(dateStr: string, ym: YearMonth): boolean {
  if (!dateStr || dateStr.length < 7) return false;
  const [yStr, mStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  return year === ym.year && month === ym.month;
}

export function getSixMonthRange(anchorYM: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    result.push(addMonths(anchorYM, -i));
  }
  return result;
}

export function compareTransactionsDesc<T extends { date: string; id: string; createdAt?: number }>(a: T, b: T): number {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  if (a.createdAt !== undefined && b.createdAt !== undefined && a.createdAt !== b.createdAt) {
    return b.createdAt - a.createdAt;
  }
  return b.id.localeCompare(a.id);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
