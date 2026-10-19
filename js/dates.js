// js/dates.js
// Safe date manipulations avoiding timezone offsets and month boundary overflow bugs

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's LOCAL timezone.
 * Avoids toISOString().split('T')[0] which truncates to UTC!
 */
export function getLocalTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current year and month as { year: YYYY, month: 1..12 }
 */
export function getCurrentYearMonth() {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1, // 1-indexed (Jan = 1, Dec = 12)
  };
}

/**
 * Safely add or subtract months from a { year, month } object without 29th-31st overflow
 */
export function addMonths(yearMonth, delta) {
  let { year, month } = yearMonth;
  const total = (year * 12) + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return { year: newYear, month: newMonth };
}

/**
 * Format { year, month } as human label (e.g., "Apr 2026")
 */
export function formatMonthYear(yearMonth, short = true) {
  const list = short ? MONTH_SHORT_NAMES : MONTH_NAMES;
  return `${list[yearMonth.month - 1]} ${yearMonth.year}`;
}

/**
 * Format { year, month } as key: "2026-04"
 */
export function toMonthKey(yearMonth) {
  return `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}`;
}

/**
 * Returns array of 6 month descriptors ending with the viewed month.
 */
export function getSixMonthWindow(viewedYearMonth) {
  const list = [];
  for (let i = 5; i >= 0; i--) {
    const ym = addMonths(viewedYearMonth, -i);
    list.push({
      year: ym.year,
      month: ym.month,
      key: toMonthKey(ym),
      label: MONTH_SHORT_NAMES[ym.month - 1],
    });
  }
  return list;
}

/**
 * Human-friendly date format for transaction list (e.g. "Apr 18, 2026")
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const mName = MONTH_SHORT_NAMES[monthIdx] || '';
  return `${mName} ${day}, ${year}`;
}

/**
 * Calendar generation helper returning array of 42 day cells
 */
export function getCalendarGrid(yearMonth) {
  const { year, month } = yearMonth;
  // first day of month (0 = Sun, 6 = Sat)
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  // total days in this month
  const daysInMonth = new Date(year, month, 0).getDate();
  // days in prev month
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells = [];

  // Previous month days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevYm = addMonths(yearMonth, -1);
    cells.push({
      day,
      month: prevYm.month,
      year: prevYm.year,
      isOtherMonth: true,
      dateString: `${prevYm.year}-${String(prevYm.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  // Current month days
  const todayStr = getLocalTodayString();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      day,
      month,
      year,
      isOtherMonth: false,
      isToday: dateString === todayStr,
      dateString,
    });
  }

  // Next month fill up to 42 cells (6 rows * 7 columns)
  const remaining = 42 - cells.length;
  const nextYm = addMonths(yearMonth, 1);
  for (let day = 1; day <= remaining; day++) {
    cells.push({
      day,
      month: nextYm.month,
      year: nextYm.year,
      isOtherMonth: true,
      dateString: `${nextYm.year}-${String(nextYm.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  return cells;
}
