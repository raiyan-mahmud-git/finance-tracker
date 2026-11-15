/**
 * Date and Month arithmetic utilities
 *
 * Bugs fixed here:
 * 1. Jan 31 + 1 month bug: In vanilla JS, `date.setMonth(date.getMonth() + 1)` on Jan 31st
 *    rolls over to March (because Feb 31st doesn't exist). We store viewed month as
 *    `{ year: number, month: number }` (month 0-11) and use pure modular integer math.
 * 2. Timezone bug: `new Date().toISOString().split('T')[0]` returns the UTC date. For users
 *    in positive timezones (e.g. UTC+6 Dhaka), late night hours return yesterday's UTC date.
 *    We extract local year, month, and day components.
 * 3. 6-Month Chart anchoring: Anchored to the currently viewed month, not hardcoded to 'Jan'-'Jun'.
 */

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

/**
 * Returns today's local date in YYYY-MM-DD format.
 */
export function getTodayLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current local YearMonth.
 */
export function getCurrentYearMonth(d: Date = new Date()): YearMonth {
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
  };
}

/**
 * Safe month arithmetic that handles year transitions and avoids the 29th-31st rollover bug.
 */
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

/**
 * Formats a YearMonth into a human-readable label, e.g. "Apr 2026".
 */
export function formatYearMonth(ym: YearMonth): string {
  return `${MONTH_NAMES_SHORT[ym.month]} ${ym.year}`;
}

/**
 * Formats a YearMonth into a full title, e.g. "April 2026".
 */
export function formatYearMonthFull(ym: YearMonth): string {
  return `${MONTH_NAMES_FULL[ym.month]} ${ym.year}`;
}

/**
 * Checks if a YYYY-MM-DD date string belongs to the given YearMonth.
 */
export function isDateInYearMonth(dateStr: string, ym: YearMonth): boolean {
  if (!dateStr || dateStr.length < 7) return false;
  const [yStr, mStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  return year === ym.year && month === ym.month;
}

/**
 * Generates an array of 6 YearMonth objects ending at the anchor YearMonth (inclusive).
 * This fixes Bug #2 (bars were hardcoded to Jan-Jun instead of actual viewed range).
 */
export function getSixMonthRange(anchorYM: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    result.push(addMonths(anchorYM, -i));
  }
  return result;
}

/**
 * Compares two transactions for stable sorting: date descending, then ID or creation tie-breaker.
 */
export function compareTransactionsDesc<T extends { date: string; id: string; createdAt?: number }>(a: T, b: T): number {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  if (a.createdAt !== undefined && b.createdAt !== undefined && a.createdAt !== b.createdAt) {
    return b.createdAt - a.createdAt;
  }
  return b.id.localeCompare(a.id);
}

/**
 * Returns number of days in a given month of a year.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns weekday of the 1st day of month (0 = Sun, 6 = Sat).
 */
export function getFirstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
