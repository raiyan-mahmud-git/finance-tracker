import { test, expect } from 'vitest';

import { escapeHtml } from '../src/modules/security.ts';
import {
  addMonths,
  getSixMonthRange,
  getTodayLocalDateString,
  compareTransactionsDesc,
  formatYearMonth,
} from '../src/modules/dates.ts';
import {
  toMinorUnits,
  fromMinorUnits,
  formatMoney,
  resolveCurrencyCode,
} from '../src/modules/money.ts';
import {
  calculateCumulativeBalance,
  calculateMonthSummary,
} from '../src/modules/analytics.ts';
import {
  migrateLegacyState,
  getDefaultPersistentData,
} from '../src/modules/storage.ts';
import {
  validateAndPreviewJSON,
  mergeData,
} from '../src/modules/importExport.ts';

test('Bug 1 (XSS): escapeHtml escapes script and malicious tags', () => {
  const maliciousInput = '<img src=x onerror="alert(1)"> & "hello" \'world\'';
  const escaped = escapeHtml(maliciousInput);

  expect(escaped).not.toContain('<img');
  expect(escaped).not.toContain('"alert(1)"');
  expect(escaped).toBe(
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;hello&quot; &#039;world&#039;'
  );
});

test('Bug 2 (Chart Labels): 6-month range anchors dynamically to viewed month', () => {
  const viewedYM = { year: 2026, month: 10 }; // Nov (0-indexed 10)
  const range = getSixMonthRange(viewedYM);

  expect(range.length).toBe(6);
  expect(range[0]).toEqual({ year: 2026, month: 5 }); // Jun
  expect(range[5]).toEqual({ year: 2026, month: 10 }); // Nov

  const labels = range.map(formatYearMonth);
  expect(labels).toEqual([
    'Jun 2026',
    'Jul 2026',
    'Aug 2026',
    'Sep 2026',
    'Oct 2026',
    'Nov 2026',
  ]);

  const febYM = { year: 2027, month: 1 };
  const febRange = getSixMonthRange(febYM);
  expect(febRange[0]).toEqual({ year: 2026, month: 8 }); // Sep 2026
  expect(febRange[5]).toEqual({ year: 2027, month: 1 }); // Feb 2027
});

test('Bug 3 (Current Balance): cumulative balance counts all history, month net counts only viewed month', () => {
  const transactions = [
    { id: '1', date: '2026-03-15', amount: 50000, type: 'income' as const, category: 'salary', description: 'Salary', createdAt: 1 },
    { id: '2', date: '2026-03-20', amount: 20000, type: 'expense' as const, category: 'food', description: 'Groceries', createdAt: 2 },
    { id: '3', date: '2026-04-01', amount: 15000, type: 'expense' as const, category: 'rent', description: 'Rent', createdAt: 3 },
  ];

  const cumulative = calculateCumulativeBalance(transactions);
  expect(cumulative).toBe(15000);

  const aprilSummary = calculateMonthSummary(transactions, { year: 2026, month: 3 }); // Apr is 3
  expect(aprilSummary.income).toBe(0);
  expect(aprilSummary.expense).toBe(15000);
  expect(aprilSummary.net).toBe(-15000);
});

test('Bug 4 (Month Math): safe addMonths handles Jan 31st and year boundaries correctly', () => {
  const jan = { year: 2026, month: 0 };
  const nextMonth = addMonths(jan, 1);
  expect(nextMonth).toEqual({ year: 2026, month: 1 }); // February

  const dec = { year: 2026, month: 11 };
  expect(addMonths(dec, 1)).toEqual({ year: 2027, month: 0 }); // Jan 2027

  const jan2026 = { year: 2026, month: 0 };
  expect(addMonths(jan2026, -1)).toEqual({ year: 2025, month: 11 }); // Dec 2025
});

test('Bug 5 (Timezone): getTodayLocalDateString returns local YYYY-MM-DD and sorting is stable', () => {
  const localDate = new Date(2026, 9, 18, 2, 30, 0);
  const dateStr = getTodayLocalDateString(localDate);
  expect(dateStr).toBe('2026-10-18');

  const txns = [
    { id: 'b', date: '2026-10-18', createdAt: 100 },
    { id: 'a', date: '2026-10-18', createdAt: 200 },
    { id: 'c', date: '2026-10-17', createdAt: 300 },
  ];
  txns.sort(compareTransactionsDesc);
  expect(txns[0].id).toBe('a');
  expect(txns[1].id).toBe('b');
  expect(txns[2].id).toBe('c');
});

test('Bug 6 (Money): minor units eliminate float inaccuracies and format properly for BDT, JPY, USD', () => {
  const a = toMinorUnits(0.1, 'USD');
  const b = toMinorUnits(0.2, 'USD');
  expect(a + b).toBe(30);
  expect(fromMinorUnits(30, 'USD')).toBe(0.3);

  const jpyAmount = toMinorUnits(1500, 'JPY');
  expect(jpyAmount).toBe(1500);
  expect(fromMinorUnits(1500, 'JPY')).toBe(1500);

  const bdtFormatted = formatMoney(125050, 'BDT');
  expect(bdtFormatted).toMatch(/1,250\.50|1,250\.5/);

  const jpyFormatted = formatMoney(5000, 'JPY');
  expect(jpyFormatted).not.toContain('.00');
  expect(jpyFormatted).toContain('5,000');
});

test('Bug 7 (UI State): persistent storage does not serialize transient UI filters or offsets', () => {
  const legacyWithUIState = {
    transactions: [{ id: '1', date: '2026-10-01', amount: 10.5, category: 'food' }],
    budgets: [{ id: '1', category: 'food', limit: 100 }],
    currency: '$',
    currentType: 'expense',
    currentFilter: 'income',
    searchQuery: 'dinner',
    currentMonthOffset: -2,
  };

  const migrated = migrateLegacyState(legacyWithUIState);
  expect((migrated as any).currentMonthOffset).toBeUndefined();
  expect((migrated as any).currentFilter).toBeUndefined();
  expect((migrated as any).searchQuery).toBeUndefined();
  expect((migrated as any).currentType).toBeUndefined();

  expect(migrated.transactions[0].amount).toBe(1050);
  expect(migrated.budgets[0].limit).toBe(10000);
  expect(migrated.settings.currency).toBe('USD');
});

test('Bug 8 (Safe Import): rejects corrupted files, gives preview, and supports merge', () => {
  const invalid = validateAndPreviewJSON('{ invalid json ...');
  expect(invalid.valid).toBe(false);
  expect(invalid.error).toBeDefined();

  const validJson = JSON.stringify({
    schemaVersion: 2,
    transactions: [
      { id: 't1', date: '2026-10-18', amount: 4500, type: 'expense', category: 'food', description: 'Lunch' },
      { id: 't2', date: '2026-10-19', amount: 12000, type: 'income', category: 'freelance', description: 'Design' },
    ],
    budgets: [{ id: 'b1', category: 'food', limit: 20000 }],
    settings: { currency: 'USD', theme: 'light' },
  });

  const preview = validateAndPreviewJSON(validJson);
  expect(preview.valid).toBe(true);
  expect(preview.transactionCount).toBe(2);
  expect(preview.budgetCount).toBe(1);

  const current = getDefaultPersistentData();
  current.transactions = [
    { id: 't1', date: '2026-10-18', amount: 4500, type: 'expense', category: 'food', description: 'Old Lunch', createdAt: 1 },
    { id: 't0', date: '2026-10-17', amount: 2000, type: 'expense', category: 'transport', description: 'Bus', createdAt: 0 },
  ];

  const merged = mergeData(current, preview.data);
  expect(merged.transactions.length).toBe(3);
  expect(merged.transactions.some(t => t.id === 't0')).toBe(true);
  expect(merged.transactions.some(t => t.id === 't1')).toBe(true);
  expect(merged.transactions.some(t => t.id === 't2')).toBe(true);
});
