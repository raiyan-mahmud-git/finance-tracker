import { DEFAULT_CATEGORIES, CURRENT_SCHEMA_VERSION, STORAGE_KEY_V2, LEGACY_STORAGE_KEY_STATE, LEGACY_STORAGE_KEY_THEME } from './constants.ts';
import { toMinorUnits, resolveCurrencyCode } from './money.ts';
import type { PersistentData, AppSettings } from './types.ts';

export function getDefaultPersistentData(): PersistentData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    transactions: [],
    budgets: [],
    categories: [...DEFAULT_CATEGORIES],
    recurringRules: [],
    savingsGoals: [],
    settings: {
      currency: 'USD',
      theme: 'system',
    },
  };
}

export interface StorageResult {
  data: PersistentData;
  migratedFromLegacy: boolean;
  error?: string;
}

export function loadPersistentData(): StorageResult {
  let migrated = false;

  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && parsed.schemaVersion === CURRENT_SCHEMA_VERSION) {
        return {
          data: sanitizePersistentData(parsed),
          migratedFromLegacy: false,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse v2 persistent data:', err);
  }

  try {
    const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY_STATE);
    if (rawLegacy) {
      const legacyState = JSON.parse(rawLegacy);
      const migratedData = migrateLegacyState(legacyState);
      savePersistentData(migratedData);
      migrated = true;
      return {
        data: migratedData,
        migratedFromLegacy: true,
      };
    }
  } catch (err) {
    console.warn('Failed to migrate legacy state:', err);
  }

  const defaultData = getDefaultPersistentData();
  try {
    const legacyTheme = localStorage.getItem(LEGACY_STORAGE_KEY_THEME);
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
      defaultData.settings.theme = legacyTheme;
    }
  } catch {}

  return {
    data: defaultData,
    migratedFromLegacy: false,
  };
}

export function migrateLegacyState(legacy: any): PersistentData {
  const result = getDefaultPersistentData();
  const currencyCode = resolveCurrencyCode(legacy.currency || '$');
  result.settings.currency = currencyCode;

  try {
    const legacyTheme = localStorage.getItem(LEGACY_STORAGE_KEY_THEME);
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
      result.settings.theme = legacyTheme;
    }
  } catch {}

  if (Array.isArray(legacy.transactions)) {
    result.transactions = legacy.transactions
      .filter((t: any) => t && typeof t === 'object' && t.date)
      .map((t: any) => ({
        id: String(t.id || Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
        date: String(t.date),
        amount: typeof t.amount === 'number' ? toMinorUnits(t.amount, currencyCode) : 0,
        type: t.type === 'income' ? 'income' : 'expense',
        category: String(t.category || 'other'),
        description: String(t.description || (t.type === 'income' ? 'Income' : 'Expense')),
        createdAt: Number(t.createdAt) || Date.now(),
      }));
  }

  if (Array.isArray(legacy.budgets)) {
    result.budgets = legacy.budgets
      .filter((b: any) => b && typeof b === 'object' && b.category)
      .map((b: any) => ({
        id: String(b.id || Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
        category: String(b.category),
        limit: typeof b.limit === 'number' ? toMinorUnits(b.limit, currencyCode) : 0,
        rollover: false,
      }));
  }

  return result;
}

export function savePersistentData(data: PersistentData): { success: boolean; error?: string } {
  try {
    const cleanData: PersistentData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      transactions: data.transactions,
      budgets: data.budgets,
      categories: data.categories || DEFAULT_CATEGORIES,
      recurringRules: data.recurringRules || [],
      savingsGoals: data.savingsGoals || [],
      settings: {
        currency: data.settings?.currency || 'USD',
        theme: data.settings?.theme || 'system',
      },
    };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(cleanData));
    return { success: true };
  } catch (err: any) {
    console.error('LocalStorage write failed:', err);
    return {
      success: false,
      error: err?.message || 'Storage quota exceeded or storage disabled.',
    };
  }
}

function sanitizePersistentData(input: any): PersistentData {
  const defaultData = getDefaultPersistentData();
  const currencyCode = resolveCurrencyCode(input.settings?.currency || 'USD');

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    transactions: Array.isArray(input.transactions)
      ? input.transactions.map((t: any) => ({
          id: String(t.id || Math.random().toString(36).slice(2)),
          date: String(t.date || ''),
          amount: Math.round(Number(t.amount) || 0),
          type: t.type === 'income' ? 'income' : 'expense',
          category: String(t.category || 'other'),
          description: String(t.description || ''),
          createdAt: Number(t.createdAt) || Date.now(),
          recurringRuleId: t.recurringRuleId ? String(t.recurringRuleId) : undefined,
        }))
      : [],
    budgets: Array.isArray(input.budgets)
      ? input.budgets.map((b: any) => ({
          id: String(b.id || Math.random().toString(36).slice(2)),
          category: String(b.category || 'other'),
          limit: Math.round(Number(b.limit) || 0),
          rollover: Boolean(b.rollover),
        }))
      : [],
    categories: Array.isArray(input.categories) && input.categories.length > 0
      ? input.categories.map((c: any) => ({
          id: String(c.id),
          name: String(c.name),
          emoji: String(c.emoji || '📦'),
          color: String(c.color || '#3D3AFF'),
          isCustom: Boolean(c.isCustom),
        }))
      : [...DEFAULT_CATEGORIES],
    recurringRules: Array.isArray(input.recurringRules)
      ? input.recurringRules.map((r: any) => ({
          id: String(r.id),
          frequency: r.frequency === 'weekly' ? 'weekly' : 'monthly',
          amount: Math.round(Number(r.amount) || 0),
          type: r.type === 'income' ? 'income' : 'expense',
          category: String(r.category || 'other'),
          description: String(r.description || ''),
          startDate: String(r.startDate || ''),
          paused: Boolean(r.paused),
          lastGeneratedDate: r.lastGeneratedDate ? String(r.lastGeneratedDate) : undefined,
        }))
      : [],
    savingsGoals: Array.isArray(input.savingsGoals)
      ? input.savingsGoals.map((g: any) => ({
          id: String(g.id),
          name: String(g.name || 'Savings Goal'),
          targetAmount: Math.round(Number(g.targetAmount) || 0),
          currentAmount: Math.round(Number(g.currentAmount) || 0),
          targetDate: String(g.targetDate || ''),
          emoji: String(g.emoji || '🎯'),
        }))
      : [],
    settings: {
      currency: currencyCode,
      theme: (['system', 'light', 'dark'].includes(input.settings?.theme) ? input.settings.theme : 'system') as any,
    },
  };
}
