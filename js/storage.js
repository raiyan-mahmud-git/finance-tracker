// js/storage.js
// Safe storage layer with schema versioning, migrations from flo_state, and error handling.

import { toMinorUnits } from './money.js';

export const CURRENT_SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'flo_app_data_v2';
export const LEGACY_STORAGE_KEY = 'flo_state';
export const THEME_STORAGE_KEY = 'flo_theme';

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', emoji: '🍔', color: '#FF7043', isIncome: false },
  { id: 'transport', name: 'Transportation', emoji: '🚗', color: '#42A5F5', isIncome: false },
  { id: 'housing', name: 'Housing & Rent', emoji: '🏠', color: '#AB47BC', isIncome: false },
  { id: 'utilities', name: 'Utilities', emoji: '⚡', color: '#FFA726', isIncome: false },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎮', color: '#26A69A', isIncome: false },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#EC407A', isIncome: false },
  { id: 'health', name: 'Health & Medical', emoji: '💊', color: '#EF5350', isIncome: false },
  { id: 'education', name: 'Education', emoji: '📚', color: '#7E57C2', isIncome: false },
  { id: 'groceries', name: 'Groceries', emoji: '🛒', color: '#66BB6A', isIncome: false },
  { id: 'salary', name: 'Salary', emoji: '💼', color: '#1FAB6E', isIncome: true },
  { id: 'freelance', name: 'Freelance', emoji: '💻', color: '#29B6F6', isIncome: true },
  { id: 'investment', name: 'Investment', emoji: '📈', color: '#26C6DA', isIncome: true },
  { id: 'gift', name: 'Gift', emoji: '🎁', color: '#FFCA28', isIncome: true },
  { id: 'other', name: 'Other', emoji: '📦', color: '#8D6E63', isIncome: false },
];

export function getInitialState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    transactions: [],
    budgets: [],
    categories: [...DEFAULT_CATEGORIES],
    recurring: [],
    goals: [],
    settings: {
      currency: 'USD',
      theme: 'system', // 'light' | 'dark' | 'system'
    },
    // Remembers last used category per transaction description for Quick-Add
    descriptionCategoryMap: {},
  };
}

/**
 * Migrate legacy flo_state (float amounts, missing categories/goals/recurring) to v2
 */
export function migrateFromLegacy(legacyData) {
  const initial = getInitialState();
  if (!legacyData || typeof legacyData !== 'object') return initial;

  const currencyKey = legacyData.currency === '€' ? 'EUR' :
                      legacyData.currency === '£' ? 'GBP' :
                      legacyData.currency === '৳' ? 'BDT' :
                      legacyData.currency === '¥' ? 'JPY' :
                      legacyData.currency === '₹' ? 'INR' :
                      legacyData.currency === '₨' ? 'PKR' :
                      legacyData.currency === '₽' ? 'RUB' :
                      legacyData.currency === '₩' ? 'KRW' : 'USD';

  // Migrate transactions: convert float amount to integer minor units
  const transactions = Array.isArray(legacyData.transactions)
    ? legacyData.transactions.map(t => ({
        id: String(t.id || Date.now() + '-' + Math.random().toString(36).slice(2)),
        date: String(t.date || '').slice(0, 10),
        amount: typeof t.amount === 'number' ? toMinorUnits(t.amount, currencyKey) : 0,
        type: t.type === 'income' ? 'income' : 'expense',
        category: t.category || 'other',
        description: String(t.description || '').trim() || (t.type === 'income' ? 'Income' : 'Expense'),
      }))
    : [];

  // Migrate budgets: convert float limit to integer minor units
  const budgets = Array.isArray(legacyData.budgets)
    ? legacyData.budgets.map(b => ({
        id: String(b.id || Date.now() + '-' + Math.random().toString(36).slice(2)),
        category: b.category,
        limit: typeof b.limit === 'number' ? toMinorUnits(b.limit, currencyKey) : 0,
        rollover: Boolean(b.rollover),
      }))
    : [];

  return {
    ...initial,
    transactions,
    budgets,
    settings: {
      ...initial.settings,
      currency: currencyKey,
    },
  };
}

/**
 * Load state from localStorage with safe fallback and migrations
 */
export function loadStateFromStorage() {
  try {
    // Check v2 storage first
    const v2Raw = localStorage.getItem(STORAGE_KEY);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      if (parsed && typeof parsed === 'object') {
        // Ensure all required collections exist
        const initial = getInitialState();
        return {
          ...initial,
          ...parsed,
          categories: parsed.categories?.length ? parsed.categories : initial.categories,
          settings: { ...initial.settings, ...parsed.settings },
        };
      }
    }

    // Check legacy flo_state
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      const migrated = migrateFromLegacy(parsed);
      // Save migrated data to v2
      saveStateToStorage(migrated);
      return migrated;
    }
  } catch (err) {
    console.error('Failed to load state from storage:', err);
  }

  return getInitialState();
}

/**
 * Save state to localStorage. Only persists core data and settings (Bug 7 fix).
 */
export function saveStateToStorage(data) {
  try {
    const payload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      transactions: data.transactions || [],
      budgets: data.budgets || [],
      categories: data.categories || DEFAULT_CATEGORIES,
      recurring: data.recurring || [],
      goals: data.goals || [],
      settings: data.settings || { currency: 'USD', theme: 'system' },
      descriptionCategoryMap: data.descriptionCategoryMap || {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { success: true };
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Validate imported data structure (Bug 8 fix)
 */
export function validateImportPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'File content must be a JSON object.' };
  }

  // Handle both v1/legacy and v2 structures
  let txns = [];
  let budgets = [];
  let categories = [];
  let isLegacy = false;

  if (Array.isArray(raw.transactions)) {
    txns = raw.transactions;
  }
  if (Array.isArray(raw.budgets)) {
    budgets = raw.budgets;
  }
  if (Array.isArray(raw.categories)) {
    categories = raw.categories;
  }

  // Detect if amount is in floats (legacy)
  if (txns.length > 0 && typeof txns[0].amount === 'number' && !raw.schemaVersion) {
    isLegacy = true;
  }

  return {
    valid: true,
    isLegacy,
    preview: {
      transactionCount: txns.length,
      budgetCount: budgets.length,
      categoryCount: categories.length,
      goalsCount: Array.isArray(raw.goals) ? raw.goals.length : 0,
      recurringCount: Array.isArray(raw.recurring) ? raw.recurring.length : 0,
    },
    raw,
  };
}
