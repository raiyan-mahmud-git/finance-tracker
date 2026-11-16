import { DEFAULT_CATEGORIES } from './constants.ts';
import { resolveCurrencyCode, toMinorUnits, fromMinorUnits } from './money.ts';
import type { PersistentData, Transaction, Budget, Category, SavingsGoal, RecurringRule } from './types.ts';

export interface ImportPreview {
  valid: boolean;
  error?: string;
  transactionCount: number;
  budgetCount: number;
  categoryCount: number;
  savingsGoalCount: number;
  recurringRuleCount: number;
  currency: string;
  data: PersistentData;
}

export function validateAndPreviewJSON(jsonStr: string): ImportPreview {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        error: 'Uploaded file is not a valid JSON object.',
        transactionCount: 0,
        budgetCount: 0,
        categoryCount: 0,
        savingsGoalCount: 0,
        recurringRuleCount: 0,
        currency: 'USD',
        data: {} as any,
      };
    }

    // Detect if this is legacy flo_state (where amount is floating point dollar)
    const isLegacy = !parsed.schemaVersion && Array.isArray(parsed.transactions);
    const currency = resolveCurrencyCode(parsed.currency || parsed.settings?.currency || 'USD');

    const cleanTransactions: Transaction[] = [];
    if (Array.isArray(parsed.transactions)) {
      for (const t of parsed.transactions) {
        if (!t || typeof t !== 'object') continue;
        const date = typeof t.date === 'string' ? t.date.trim() : '';
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

        let amountMinor = 0;
        if (typeof t.amount === 'number') {
          // If legacy, float dollars -> minor units. If v2, already minor units
          amountMinor = isLegacy ? toMinorUnits(t.amount, currency) : Math.round(t.amount);
        }

        cleanTransactions.push({
          id: String(t.id || Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
          date,
          amount: Math.max(0, amountMinor),
          type: t.type === 'income' ? 'income' : 'expense',
          category: String(t.category || 'other').slice(0, 50),
          description: String(t.description || '').slice(0, 200),
          createdAt: Number(t.createdAt) || Date.now(),
        });
      }
    }

    const cleanBudgets: Budget[] = [];
    if (Array.isArray(parsed.budgets)) {
      for (const b of parsed.budgets) {
        if (!b || typeof b !== 'object' || !b.category) continue;
        let limitMinor = 0;
        if (typeof b.limit === 'number') {
          limitMinor = isLegacy ? toMinorUnits(b.limit, currency) : Math.round(b.limit);
        }
        cleanBudgets.push({
          id: String(b.id || Math.random().toString(36).slice(2)),
          category: String(b.category),
          limit: Math.max(0, limitMinor),
          rollover: Boolean(b.rollover),
        });
      }
    }

    const cleanCategories: Category[] = Array.isArray(parsed.categories) && parsed.categories.length > 0
      ? parsed.categories.map((c: any) => ({
          id: String(c.id),
          name: String(c.name || 'Category'),
          emoji: String(c.emoji || '📦'),
          color: String(c.color || '#3D3AFF'),
          isCustom: Boolean(c.isCustom),
        }))
      : [...DEFAULT_CATEGORIES];

    const cleanGoals: SavingsGoal[] = Array.isArray(parsed.savingsGoals)
      ? parsed.savingsGoals.map((g: any) => ({
          id: String(g.id || Math.random().toString(36).slice(2)),
          name: String(g.name || 'Savings Goal'),
          targetAmount: Math.round(Number(g.targetAmount) || 0),
          currentAmount: Math.round(Number(g.currentAmount) || 0),
          targetDate: String(g.targetDate || ''),
          emoji: String(g.emoji || '🎯'),
        }))
      : [];

    const cleanRules: RecurringRule[] = Array.isArray(parsed.recurringRules)
      ? parsed.recurringRules.map((r: any) => ({
          id: String(r.id || Math.random().toString(36).slice(2)),
          frequency: r.frequency === 'weekly' ? 'weekly' : 'monthly',
          amount: Math.round(Number(r.amount) || 0),
          type: r.type === 'income' ? 'income' : 'expense',
          category: String(r.category || 'other'),
          description: String(r.description || ''),
          startDate: String(r.startDate || ''),
          paused: Boolean(r.paused),
        }))
      : [];

    const validatedData: PersistentData = {
      schemaVersion: 2,
      transactions: cleanTransactions,
      budgets: cleanBudgets,
      categories: cleanCategories,
      savingsGoals: cleanGoals,
      recurringRules: cleanRules,
      settings: {
        currency,
        theme: parsed.settings?.theme === 'light' || parsed.settings?.theme === 'dark' ? parsed.settings.theme : 'system',
      },
    };

    return {
      valid: true,
      transactionCount: cleanTransactions.length,
      budgetCount: cleanBudgets.length,
      categoryCount: cleanCategories.length,
      savingsGoalCount: cleanGoals.length,
      recurringRuleCount: cleanRules.length,
      currency,
      data: validatedData,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `JSON parse error: ${err.message}`,
      transactionCount: 0,
      budgetCount: 0,
      categoryCount: 0,
      savingsGoalCount: 0,
      recurringRuleCount: 0,
      currency: 'USD',
      data: {} as any,
    };
  }
}

export function mergeData(current: PersistentData, imported: PersistentData): PersistentData {
  const existingTxnIds = new Set(current.transactions.map(t => t.id));
  const newTxns = imported.transactions.filter(t => !existingTxnIds.has(t.id));

  const budgetMap = new Map<string, Budget>();
  current.budgets.forEach(b => budgetMap.set(b.category, b));
  imported.budgets.forEach(b => budgetMap.set(b.category, b)); // imported overrides or adds

  const catMap = new Map<string, Category>();
  current.categories.forEach(c => catMap.set(c.id, c));
  imported.categories.forEach(c => catMap.set(c.id, c));

  return {
    ...current,
    transactions: [...current.transactions, ...newTxns],
    budgets: Array.from(budgetMap.values()),
    categories: Array.from(catMap.values()),
    savingsGoals: [...current.savingsGoals, ...imported.savingsGoals.filter(g => !current.savingsGoals.some(cg => cg.id === g.id))],
    recurringRules: [...current.recurringRules, ...imported.recurringRules.filter(r => !current.recurringRules.some(cr => cr.id === r.id))],
  };
}

export function exportTransactionsToCSV(transactions: Transaction[], currency: string): string {
  const BOM = '\uFEFF';
  const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Currency'];

  const rows = transactions.map(t => {
    const formattedAmount = fromMinorUnits(t.amount, currency).toFixed(2);
    const escapedDesc = `"${(t.description || '').replace(/"/g, '""')}"`;
    const escapedCat = `"${(t.category || '').replace(/"/g, '""')}"`;
    return [t.id, t.date, t.type, escapedCat, escapedDesc, formattedAmount, currency].join(',');
  });

  return BOM + [headers.join(','), ...rows].join('\r\n');
}

export function parseTransactionsFromCSV(csvText: string, currentCurrency = 'USD'): ImportPreview {
  try {
    // Strip BOM if present
    const cleanCsv = csvText.replace(/^\uFEFF/, '');
    const lines = cleanCsv.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return {
        valid: false,
        error: 'CSV must contain at least a header row and one transaction row.',
        transactionCount: 0,
        budgetCount: 0,
        categoryCount: 0,
        savingsGoalCount: 0,
        recurringRuleCount: 0,
        currency: currentCurrency,
        data: {} as any,
      };
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const dateIdx = headers.indexOf('date');
    const typeIdx = headers.indexOf('type');
    const catIdx = headers.indexOf('category');
    const descIdx = headers.indexOf('description');
    const amountIdx = headers.indexOf('amount');

    if (dateIdx === -1 || amountIdx === -1) {
      return {
        valid: false,
        error: 'CSV must have "Date" and "Amount" columns.',
        transactionCount: 0,
        budgetCount: 0,
        categoryCount: 0,
        savingsGoalCount: 0,
        recurringRuleCount: 0,
        currency: currentCurrency,
        data: {} as any,
      };
    }

    const transactions: Transaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;

      const dateStr = cols[dateIdx]?.trim();
      const rawAmount = parseFloat(cols[amountIdx]?.replace(/[^0-9.-]/g, ''));
      if (!dateStr || isNaN(rawAmount)) continue;

      const typeStr = (typeIdx !== -1 ? cols[typeIdx]?.trim().toLowerCase() : '') || 'expense';
      const type = typeStr === 'income' ? 'income' : 'expense';
      const category = (catIdx !== -1 ? cols[catIdx]?.trim() : 'other') || 'other';
      const description = descIdx !== -1 ? cols[descIdx]?.trim() : (type === 'income' ? 'Income' : 'Expense');

      transactions.push({
        id: `csv-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        date: dateStr,
        amount: toMinorUnits(Math.abs(rawAmount), currentCurrency),
        type,
        category,
        description,
        createdAt: Date.now() - (lines.length - i) * 1000,
      });
    }

    const data: PersistentData = {
      schemaVersion: 2,
      transactions,
      budgets: [],
      categories: [...DEFAULT_CATEGORIES],
      recurringRules: [],
      savingsGoals: [],
      settings: {
        currency: currentCurrency,
        theme: 'system',
      },
    };

    return {
      valid: true,
      transactionCount: transactions.length,
      budgetCount: 0,
      categoryCount: DEFAULT_CATEGORIES.length,
      savingsGoalCount: 0,
      recurringRuleCount: 0,
      currency: currentCurrency,
      data,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to parse CSV: ${err.message}`,
      transactionCount: 0,
      budgetCount: 0,
      categoryCount: 0,
      savingsGoalCount: 0,
      recurringRuleCount: 0,
      currency: currentCurrency,
      data: {} as any,
    };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
