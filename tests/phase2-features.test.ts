import { test, expect } from 'vitest';

import {
  generateRecurringTransactions,
  getNextOccurrenceDate,
} from '../src/modules/recurring.ts';
import {
  calculateBudgetStatuses,
  calculateInsights,
} from '../src/modules/analytics.ts';
import {
  exportTransactionsToCSV,
  parseTransactionsFromCSV,
} from '../src/modules/importExport.ts';
import type { RecurringRule, Transaction, Budget } from '../src/modules/types.ts';

test('Recurring transactions: generates due occurrences and respects pause', () => {
  const rules: RecurringRule[] = [
    {
      id: 'rule-sub',
      frequency: 'monthly',
      amount: 1500, // $15.00
      type: 'expense',
      category: 'entertainment',
      description: 'Streaming Subscription',
      startDate: '2026-08-01',
      paused: false,
    },
    {
      id: 'rule-gym',
      frequency: 'monthly',
      amount: 4000,
      type: 'expense',
      category: 'health',
      description: 'Gym Membership',
      startDate: '2026-08-01',
      paused: true,
    },
  ];

  const existing: Transaction[] = [];
  const result = generateRecurringTransactions(rules, existing, '2026-10-18');

  expect(result.newTransactions.filter(t => t.recurringRuleId === 'rule-gym').length).toBe(0);

  const subTxns = result.newTransactions.filter(t => t.recurringRuleId === 'rule-sub');
  expect(subTxns.length).toBe(3);
  expect(subTxns.map(t => t.date)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);

  // Idempotency: running again with generated transactions produces no new transactions
  const secondRun = generateRecurringTransactions(result.updatedRules, subTxns, '2026-10-18');
  expect(secondRun.newTransactions.length).toBe(0);
});

test('Recurring transactions: weekly schedule steps by 7 days', () => {
  expect(getNextOccurrenceDate('2026-10-01', 'weekly')).toBe('2026-10-08');
  expect(getNextOccurrenceDate('2026-10-25', 'weekly')).toBe('2026-11-01');
});

test('Budgets: computes over-budget, 80% warning, and rollover from prior month', () => {
  const budgets: Budget[] = [
    { id: 'b1', category: 'dining', limit: 20000, rollover: false }, // $200.00
    { id: 'b2', category: 'groceries', limit: 30000, rollover: true }, // $300.00 with rollover
    { id: 'b3', category: 'travel', limit: 10000, rollover: false }, // $100.00
  ];

  const transactions: Transaction[] = [
    // Prior month (September 2026): groceries had $100 unspent ($300 limit - $200 spent)
    { id: 'p1', date: '2026-09-10', amount: 20000, type: 'expense', category: 'groceries', description: 'Sept Groceries', createdAt: 1 },

    { id: 'c1', date: '2026-10-05', amount: 24000, type: 'expense', category: 'dining', description: 'Steakhouse', createdAt: 2 },
    { id: 'c2', date: '2026-10-07', amount: 8500, type: 'expense', category: 'travel', description: 'Train Ticket', createdAt: 3 },
    // Groceries: spent 35000. Normal limit 30000, but with rollover +10000 from Sept -> effective limit 40000!
    { id: 'c3', date: '2026-10-12', amount: 35000, type: 'expense', category: 'groceries', description: 'Oct Groceries', createdAt: 4 },
  ];

  const statuses = calculateBudgetStatuses(budgets, transactions, { year: 2026, month: 9 }); // Oct (0-indexed 9)

  const dining = statuses.find(s => s.budget.category === 'dining')!;
  expect(dining.spent).toBe(24000);
  expect(dining.isOverBudget).toBe(true);
  expect(dining.percentage).toBe(120); // Not capped at 100%!
  expect(dining.remaining).toBe(-4000);

  const travel = statuses.find(s => s.budget.category === 'travel')!;
  expect(travel.spent).toBe(8500);
  expect(travel.percentage).toBe(85);
  expect(travel.isWarning).toBe(true);
  expect(travel.isOverBudget).toBe(false);

  const groceries = statuses.find(s => s.budget.category === 'groceries')!;
  expect(groceries.effectiveLimit).toBe(40000); // 30000 + 10000 rollover
  expect(groceries.spent).toBe(35000);
  expect(groceries.isOverBudget).toBe(false);
  expect(groceries.remaining).toBe(5000);
});

test('Insights: daily average, projected month-end, and category comparisons', () => {
  const transactions: Transaction[] = [
    { id: '1', date: '2026-09-15', amount: 10000, type: 'expense', category: 'dining', description: 'Dinner', createdAt: 1 },
    { id: '2', date: '2026-10-05', amount: 30000, type: 'expense', category: 'dining', description: 'Dinner party', createdAt: 2 },
  ];

  const mockToday = new Date(2026, 9, 10); // Day 10 of Oct 2026
  const insights = calculateInsights(transactions, { year: 2026, month: 9 }, mockToday);

  expect(insights.avgDailySpend).toBe(3000);
  expect(insights.projectedMonthEndSpend).toBe(93000);

  expect(insights.biggestChangeCategory).toBeDefined();
  expect(insights.biggestChangeCategory?.categoryId).toBe('dining');
  expect(insights.biggestChangeCategory?.diff).toBe(20000);
  expect(insights.isOverPace).toBe(true);
});

test('CSV export/import: UTF-8 BOM preserves symbols and parses back correctly', () => {
  const txns: Transaction[] = [
    {
      id: 'tx-1',
      date: '2026-10-18',
      amount: 150000, // 1500.00
      type: 'income',
      category: 'salary',
      description: 'Monthly Salary (with special chars: ৳ & "quoted")',
      createdAt: 1000,
    },
    {
      id: 'tx-2',
      date: '2026-10-18',
      amount: 2550, // 25.50
      type: 'expense',
      category: 'food',
      description: 'Coffee & croissant',
      createdAt: 1001,
    },
  ];

  const csv = exportTransactionsToCSV(txns, 'BDT');
  // Must start with UTF-8 BOM \uFEFF for Excel
  expect(csv.charCodeAt(0)).toBe(0xFEFF);
  expect(csv).toContain('Monthly Salary (with special chars: ৳ & ""quoted"")');

  const parsed = parseTransactionsFromCSV(csv, 'BDT');
  expect(parsed.valid).toBe(true);
  expect(parsed.transactionCount).toBe(2);

  const importedTxn1 = parsed.data.transactions[0];
  expect(importedTxn1.amount).toBe(150000);
  expect(importedTxn1.type).toBe('income');
  expect(importedTxn1.description).toBe('Monthly Salary (with special chars: ৳ & "quoted")');
});
