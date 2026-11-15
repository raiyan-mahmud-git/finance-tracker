/**
 * Recurring Transactions Processor
 *
 * Requirements:
 * - Supports weekly and monthly recurring schedules.
 * - Generates missing occurrences up to today's date (or viewed month).
 * - Allows pausing/unpausing recurring rules.
 * - Ensures idempotency (does not generate duplicates).
 */

import { addMonths, getTodayLocalDateString } from './dates.ts';
import type { RecurringRule, Transaction } from './types.ts';

/**
 * Checks for any active recurring rules and generates due transactions up to targetDate (default today).
 */
export function generateRecurringTransactions(
  rules: RecurringRule[],
  existingTransactions: Transaction[],
  targetDateStr: string = getTodayLocalDateString()
): { newTransactions: Transaction[]; updatedRules: RecurringRule[] } {
  const newTransactions: Transaction[] = [];
  const updatedRules: RecurringRule[] = rules.map(r => ({ ...r }));

  for (const rule of updatedRules) {
    if (rule.paused) continue;

    // Last generated date or start date
    let lastDate = rule.lastGeneratedDate || rule.startDate;
    if (lastDate > targetDateStr) continue;

    // If first time and rule.startDate is today or in past, generate initial if not exists
    if (!rule.lastGeneratedDate) {
      if (rule.startDate <= targetDateStr) {
        const id = `rec-${rule.id}-${rule.startDate}`;
        const alreadyExists = existingTransactions.some(t => t.id === id || (t.recurringRuleId === rule.id && t.date === rule.startDate));
        if (!alreadyExists) {
          newTransactions.push({
            id,
            date: rule.startDate,
            amount: rule.amount,
            type: rule.type,
            category: rule.category,
            description: rule.description,
            createdAt: Date.now(),
            recurringRuleId: rule.id,
          });
        }
        rule.lastGeneratedDate = rule.startDate;
        lastDate = rule.startDate;
      }
    }

    // Step forward
    while (true) {
      const nextDate = getNextOccurrenceDate(lastDate, rule.frequency);
      if (nextDate > targetDateStr) break;

      const id = `rec-${rule.id}-${nextDate}`;
      const alreadyExists = existingTransactions.some(t => t.id === id || (t.recurringRuleId === rule.id && t.date === nextDate))
        || newTransactions.some(t => t.id === id);

      if (!alreadyExists) {
        newTransactions.push({
          id,
          date: nextDate,
          amount: rule.amount,
          type: rule.type,
          category: rule.category,
          description: rule.description,
          createdAt: Date.now(),
          recurringRuleId: rule.id,
        });
      }

      rule.lastGeneratedDate = nextDate;
      lastDate = nextDate;
    }
  }

  return { newTransactions, updatedRules };
}

/**
 * Calculates next date string for weekly or monthly cadence without timezone shifts.
 */
export function getNextOccurrenceDate(currentDateStr: string, frequency: 'weekly' | 'monthly'): string {
  const [yStr, mStr, dStr] = currentDateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  const day = parseInt(dStr, 10);

  if (frequency === 'weekly') {
    // Add 7 days
    const d = new Date(year, month, day + 7);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    const nd = String(d.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  } else {
    // Add 1 month safely
    const nextYM = addMonths({ year, month }, 1);
    const maxDaysNextMonth = new Date(nextYM.year, nextYM.month + 1, 0).getDate();
    const nextDay = Math.min(day, maxDaysNextMonth);
    const nm = String(nextYM.month + 1).padStart(2, '0');
    const nd = String(nextDay).padStart(2, '0');
    return `${nextYM.year}-${nm}-${nd}`;
  }
}
