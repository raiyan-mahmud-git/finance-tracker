import { addMonths, getDaysInMonth, isDateInYearMonth } from './dates.ts';
import type { YearMonth } from './dates.ts';
import type { Budget, Transaction } from './types.ts';

export interface MonthSummary {
  income: number; // in minor units
  expense: number; // in minor units
  net: number; // income - expense
  incomeCount: number;
  expenseCount: number;
}

export interface BudgetStatus {
  budget: Budget;
  spent: number; // in minor units
  effectiveLimit: number; // in minor units (including rollover if enabled)
  percentage: number; // uncapped percentage (e.g. 115%)
  isOverBudget: boolean;
  isWarning: boolean; // >= 80% and <= 100%
  remaining: number; // limit - spent (can be negative if over budget)
}

export interface InsightsData {
  avgDailySpend: number; // minor units
  projectedMonthEndSpend: number; // minor units
  paceMessage: string;
  isOverPace: boolean;
  biggestChangeCategory?: {
    categoryId: string;
    diff: number; // positive = increased spending
    percentageDiff: number;
    currentMonthSpend: number;
    previousMonthSpend: number;
  };
}

export function calculateCumulativeBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => {
    return t.type === 'income' ? acc + t.amount : acc - t.amount;
  }, 0);
}

export function calculateMonthSummary(transactions: Transaction[], ym: YearMonth): MonthSummary {
  const monthTxns = transactions.filter(t => isDateInYearMonth(t.date, ym));
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const t of monthTxns) {
    if (t.type === 'income') {
      income += t.amount;
      incomeCount++;
    } else {
      expense += t.amount;
      expenseCount++;
    }
  }

  return {
    income,
    expense,
    net: income - expense,
    incomeCount,
    expenseCount,
  };
}

export function calculateBudgetStatuses(
  budgets: Budget[],
  transactions: Transaction[],
  ym: YearMonth
): BudgetStatus[] {
  const currentMonthTxns = transactions.filter(t => isDateInYearMonth(t.date, ym));

  return budgets.map(b => {
    const spent = currentMonthTxns
      .filter(t => t.type === 'expense' && t.category === b.category)
      .reduce((acc, t) => acc + t.amount, 0);

    let effectiveLimit = b.limit;

    // Rollover logic: if rollover enabled, add unspent from prior month
    if (b.rollover) {
      const priorYM = addMonths(ym, -1);
      const priorSpent = transactions
        .filter(t => isDateInYearMonth(t.date, priorYM) && t.type === 'expense' && t.category === b.category)
        .reduce((acc, t) => acc + t.amount, 0);
      const priorSurplus = b.limit - priorSpent;
      // Add previous month's surplus (if any) to this month's limit
      if (priorSurplus > 0) {
        effectiveLimit += priorSurplus;
      }
    }

    const percentage = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : (spent > 0 ? 100 : 0);
    const isOverBudget = spent > effectiveLimit;
    const isWarning = percentage >= 80 && !isOverBudget;
    const remaining = effectiveLimit - spent;

    return {
      budget: b,
      spent,
      effectiveLimit,
      percentage,
      isOverBudget,
      isWarning,
      remaining,
    };
  });
}

export function calculateInsights(
  transactions: Transaction[],
  ym: YearMonth,
  today: Date = new Date()
): InsightsData {
  const monthTxns = transactions.filter(t => isDateInYearMonth(t.date, ym));
  const currentMonthExpenses = monthTxns.filter(t => t.type === 'expense');
  const totalCurrentSpend = currentMonthExpenses.reduce((acc, t) => acc + t.amount, 0);

  const daysInMonth = getDaysInMonth(ym.year, ym.month);

  const isCurrentCalendarMonth = today.getFullYear() === ym.year && today.getMonth() === ym.month;
  const elapsedDays = isCurrentCalendarMonth
    ? Math.max(1, today.getDate())
    : daysInMonth; // for past months, all days elapsed

  const avgDailySpend = Math.round(totalCurrentSpend / elapsedDays);
  const projectedMonthEndSpend = Math.round(avgDailySpend * daysInMonth);

  const prevYM = addMonths(ym, -1);
  const prevMonthTxns = transactions.filter(t => isDateInYearMonth(t.date, prevYM));
  const prevMonthExpenses = prevMonthTxns.filter(t => t.type === 'expense');
  const totalPrevSpend = prevMonthExpenses.reduce((acc, t) => acc + t.amount, 0);

  let isOverPace = false;
  let paceMessage = 'Spending pace is balanced.';

  if (totalPrevSpend > 0) {
    if (projectedMonthEndSpend > totalPrevSpend * 1.1) {
      isOverPace = true;
      const pctOver = Math.round(((projectedMonthEndSpend - totalPrevSpend) / totalPrevSpend) * 100);
      paceMessage = `You are on pace to spend ${pctOver}% more than last month.`;
    } else if (projectedMonthEndSpend < totalPrevSpend * 0.9) {
      const pctUnder = Math.round(((totalPrevSpend - projectedMonthEndSpend) / totalPrevSpend) * 100);
      paceMessage = `Great job! You are pacing ${pctUnder}% below last month.`;
    } else {
      paceMessage = 'Spending is consistent with your previous month pace.';
    }
  } else if (totalCurrentSpend > 0) {
    paceMessage = `Projected spend by month end: based on ${elapsedDays} day(s) of activity.`;
  } else {
    paceMessage = 'No expenses recorded for this month yet.';
  }

  const currentByCat: Record<string, number> = {};
  currentMonthExpenses.forEach(t => {
    currentByCat[t.category] = (currentByCat[t.category] || 0) + t.amount;
  });

  const prevByCat: Record<string, number> = {};
  prevMonthExpenses.forEach(t => {
    prevByCat[t.category] = (prevByCat[t.category] || 0) + t.amount;
  });

  let biggestChangeCategory: InsightsData['biggestChangeCategory'] = undefined;
  let maxAbsDiff = 0;

  const allCategories = new Set([...Object.keys(currentByCat), ...Object.keys(prevByCat)]);
  for (const cat of allCategories) {
    const cur = currentByCat[cat] || 0;
    const prv = prevByCat[cat] || 0;
    const diff = cur - prv;
    const absDiff = Math.abs(diff);

    if (absDiff > maxAbsDiff && absDiff > 0) {
      maxAbsDiff = absDiff;
      const percentageDiff = prv > 0 ? (diff / prv) * 100 : (cur > 0 ? 100 : 0);
      biggestChangeCategory = {
        categoryId: cat,
        diff,
        percentageDiff,
        currentMonthSpend: cur,
        previousMonthSpend: prv,
      };
    }
  }

  return {
    avgDailySpend,
    projectedMonthEndSpend,
    paceMessage,
    isOverPace,
    biggestChangeCategory,
  };
}
