/**
 * Reactive Store with Pub/Sub Architecture
 *
 * Requirements:
 * - Single source of truth for the entire application.
 * - Decouples persistent domain data from ephemeral UI state.
 * - Automatically writes changes to storage and notifies subscribers.
 * - Provides undo stack with toast announcements.
 * - Automatically processes due recurring transactions on load.
 */

import { DEFAULT_CATEGORIES } from './constants.ts';
import { getCurrentYearMonth, getTodayLocalDateString, addMonths } from './dates.ts';
import type { YearMonth } from './dates.ts';
import { toMinorUnits } from './money.ts';
import { generateRecurringTransactions } from './recurring.ts';
import { loadPersistentData, savePersistentData } from './storage.ts';
import type {
  Transaction,
  Budget,
  Category,
  RecurringRule,
  SavingsGoal,
  AppSettings,
  PersistentData,
  FilterType,
  SortOrder,
  ToastMessage,
  ThemePreference,
} from './types.ts';

export interface UIState {
  viewedYearMonth: YearMonth;
  activeView: 'dashboard' | 'transactions' | 'budgets' | 'goals' | 'settings';
  currentFilter: FilterType;
  startDateFilter: string;
  endDateFilter: string;
  searchQuery: string;
  currentType: 'expense' | 'income';
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
  selectedDay: number | null;
  toast: ToastMessage | null;
  lastCategoryByDescription: Record<string, string>;
  isImportModalOpen: boolean;
  isTxnModalOpen: boolean;
  editingTxn: Transaction | null;
  isBudgetModalOpen: boolean;
  editingBudget: Budget | null;
  isCategoryModalOpen: boolean;
  isGoalModalOpen: boolean;
  editingGoal: SavingsGoal | null;
  storageError: string | null;
}

export interface AppState {
  data: PersistentData;
  ui: UIState;
}

type Listener = (state: AppState) => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private toastTimer: any = null;

  constructor() {
    const loaded = loadPersistentData();
    const todayYM = getCurrentYearMonth();

    this.state = {
      data: loaded.data,
      ui: {
        viewedYearMonth: todayYM,
        activeView: 'dashboard',
        currentFilter: 'all',
        startDateFilter: '',
        endDateFilter: '',
        searchQuery: '',
        currentType: 'expense',
        sortOrder: 'date-desc',
        page: 1,
        pageSize: 15,
        selectedDay: null,
        toast: null,
        lastCategoryByDescription: {},
        isImportModalOpen: false,
        isTxnModalOpen: false,
        editingTxn: null,
        isBudgetModalOpen: false,
        editingBudget: null,
        isCategoryModalOpen: false,
        isGoalModalOpen: false,
        editingGoal: null,
        storageError: loaded.error || null,
      },
    };

    // Populate lastCategoryByDescription from past transactions
    for (const t of this.state.data.transactions) {
      if (t.description && t.category) {
        this.state.ui.lastCategoryByDescription[t.description.trim().toLowerCase()] = t.category;
      }
    }

    // Automatically check for due recurring transactions
    this.processRecurringRules();
  }

  public getState(): AppState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private persist() {
    const res = savePersistentData(this.state.data);
    if (!res.success) {
      this.state.ui.storageError = res.error || 'Failed to save data';
    } else {
      this.state.ui.storageError = null;
    }
  }

  // -------------------------------------------------------------
  // RECURRING PROCESSOR
  // -------------------------------------------------------------
  public processRecurringRules() {
    if (!this.state.data.recurringRules.length) return;
    const { newTransactions, updatedRules } = generateRecurringTransactions(
      this.state.data.recurringRules,
      this.state.data.transactions
    );

    if (newTransactions.length > 0) {
      this.state.data.transactions.push(...newTransactions);
      this.state.data.recurringRules = updatedRules;
      this.persist();
      this.notify();
      this.showToast(`Generated ${newTransactions.length} recurring transaction(s).`);
    }
  }

  // -------------------------------------------------------------
  // TRANSACTIONS
  // -------------------------------------------------------------
  public addTransaction(txn: Omit<Transaction, 'id' | 'createdAt'>) {
    const newTxn: Transaction = {
      ...txn,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };

    this.state.data.transactions.push(newTxn);
    if (newTxn.description) {
      this.state.ui.lastCategoryByDescription[newTxn.description.trim().toLowerCase()] = newTxn.category;
    }

    this.persist();
    this.notify();
  }

  public updateTransaction(updated: Transaction) {
    const idx = this.state.data.transactions.findIndex(t => t.id === updated.id);
    if (idx !== -1) {
      this.state.data.transactions[idx] = { ...updated };
      if (updated.description) {
        this.state.ui.lastCategoryByDescription[updated.description.trim().toLowerCase()] = updated.category;
      }
      this.persist();
      this.notify();
    }
  }

  public deleteTransaction(id: string) {
    const idx = this.state.data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return;

    const removed = this.state.data.transactions[idx];
    this.state.data.transactions.splice(idx, 1);
    this.persist();
    this.notify();

    // Undo toast
    this.showToast(`Deleted "${removed.description}"`, () => {
      this.state.data.transactions.splice(idx, 0, removed);
      this.persist();
      this.notify();
    });
  }

  // -------------------------------------------------------------
  // BUDGETS
  // -------------------------------------------------------------
  public saveBudget(category: string, limitMinorUnits: number, rollover = false) {
    const existingIdx = this.state.data.budgets.findIndex(b => b.category === category);
    if (existingIdx !== -1) {
      this.state.data.budgets[existingIdx].limit = limitMinorUnits;
      this.state.data.budgets[existingIdx].rollover = rollover;
    } else {
      this.state.data.budgets.push({
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        limit: limitMinorUnits,
        rollover,
      });
    }
    this.persist();
    this.notify();
  }

  public deleteBudget(id: string) {
    const idx = this.state.data.budgets.findIndex(b => b.id === id);
    if (idx === -1) return;

    const removed = this.state.data.budgets[idx];
    this.state.data.budgets.splice(idx, 1);
    this.persist();
    this.notify();

    this.showToast(`Deleted budget for "${removed.category}"`, () => {
      this.state.data.budgets.splice(idx, 0, removed);
      this.persist();
      this.notify();
    });
  }

  // -------------------------------------------------------------
  // CATEGORIES
  // -------------------------------------------------------------
  public addCategory(cat: Omit<Category, 'id' | 'isCustom'>) {
    const id = `cat-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36).slice(-3)}`;
    this.state.data.categories.push({
      ...cat,
      id,
      isCustom: true,
    });
    this.persist();
    this.notify();
  }

  public updateCategory(cat: Category) {
    const idx = this.state.data.categories.findIndex(c => c.id === cat.id);
    if (idx !== -1) {
      this.state.data.categories[idx] = { ...cat };
      this.persist();
      this.notify();
    }
  }

  public deleteCategory(id: string, reassignToId = 'other') {
    // Cannot delete if only 1 category remains
    if (this.state.data.categories.length <= 1) return;

    const idx = this.state.data.categories.findIndex(c => c.id === id);
    if (idx === -1) return;

    const removedCat = this.state.data.categories[idx];
    this.state.data.categories.splice(idx, 1);

    // Reassign transactions
    const affectedTxns = this.state.data.transactions.filter(t => t.category === id);
    affectedTxns.forEach(t => {
      t.category = reassignToId;
    });

    // Remove or reassign budget
    this.state.data.budgets = this.state.data.budgets.filter(b => b.category !== id);

    this.persist();
    this.notify();

    this.showToast(`Deleted category "${removedCat.name}" (reassigned ${affectedTxns.length} txns to "${reassignToId}")`);
  }

  // -------------------------------------------------------------
  // RECURRING RULES
  // -------------------------------------------------------------
  public addRecurringRule(rule: Omit<RecurringRule, 'id'>) {
    const newRule: RecurringRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    this.state.data.recurringRules.push(newRule);
    this.persist();
    this.processRecurringRules();
    this.notify();
  }

  public togglePauseRecurringRule(id: string) {
    const rule = this.state.data.recurringRules.find(r => r.id === id);
    if (rule) {
      rule.paused = !rule.paused;
      this.persist();
      this.notify();
      this.showToast(rule.paused ? `Paused "${rule.description}"` : `Resumed "${rule.description}"`);
    }
  }

  public deleteRecurringRule(id: string) {
    this.state.data.recurringRules = this.state.data.recurringRules.filter(r => r.id !== id);
    this.persist();
    this.notify();
  }

  // -------------------------------------------------------------
  // SAVINGS GOALS
  // -------------------------------------------------------------
  public addSavingsGoal(goal: Omit<SavingsGoal, 'id'>) {
    this.state.data.savingsGoals.push({
      ...goal,
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });
    this.persist();
    this.notify();
  }

  public updateSavingsGoal(goal: SavingsGoal) {
    const idx = this.state.data.savingsGoals.findIndex(g => g.id === goal.id);
    if (idx !== -1) {
      this.state.data.savingsGoals[idx] = { ...goal };
      this.persist();
      this.notify();
    }
  }

  public contributeToGoal(id: string, amountMinorUnits: number) {
    const goal = this.state.data.savingsGoals.find(g => g.id === id);
    if (goal) {
      goal.currentAmount = Math.max(0, goal.currentAmount + amountMinorUnits);
      this.persist();
      this.notify();
    }
  }

  public deleteSavingsGoal(id: string) {
    this.state.data.savingsGoals = this.state.data.savingsGoals.filter(g => g.id !== id);
    this.persist();
    this.notify();
  }

  // -------------------------------------------------------------
  // SETTINGS & UI ACTIONS
  // -------------------------------------------------------------
  public setCurrency(currency: string) {
    this.state.data.settings.currency = currency;
    this.persist();
    this.notify();
  }

  public setTheme(theme: ThemePreference) {
    this.state.data.settings.theme = theme;
    this.persist();
    this.applyTheme(theme);
    this.notify();
  }

  public applyTheme(theme: ThemePreference = this.state.data.settings.theme) {
    let activeTheme = theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', activeTheme);
  }

  public setView(view: UIState['activeView']) {
    this.state.ui.activeView = view;
    this.notify();
  }

  public changeMonth(delta: number) {
    this.state.ui.viewedYearMonth = addMonths(this.state.ui.viewedYearMonth, delta);
    this.state.ui.selectedDay = null;
    this.notify();
  }

  public jumpToYearMonth(ym: YearMonth, day: number | null = null) {
    this.state.ui.viewedYearMonth = ym;
    this.state.ui.selectedDay = day;
    this.notify();
  }

  public setFilter(filter: FilterType) {
    this.state.ui.currentFilter = filter;
    this.state.ui.page = 1;
    this.notify();
  }

  public setDateRangeFilter(start: string, end: string) {
    this.state.ui.startDateFilter = start;
    this.state.ui.endDateFilter = end;
    this.state.ui.currentFilter = 'custom';
    this.state.ui.page = 1;
    this.notify();
  }

  public setSearchQuery(query: string) {
    this.state.ui.searchQuery = query;
    this.state.ui.page = 1;
    this.notify();
  }

  public setSortOrder(order: SortOrder) {
    this.state.ui.sortOrder = order;
    this.notify();
  }

  public setPage(page: number) {
    this.state.ui.page = Math.max(1, page);
    this.notify();
  }

  public showToast(message: string, undoAction?: () => void, duration = 5000) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.state.ui.toast = {
      id: `toast-${Date.now()}`,
      message,
      undoAction,
      duration,
    };
    this.notify();

    if (!undoAction) {
      this.toastTimer = setTimeout(() => {
        this.state.ui.toast = null;
        this.notify();
      }, duration);
    }
  }

  public dismissToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.state.ui.toast = null;
    this.notify();
  }

  public clearAllData() {
    this.state.data.transactions = [];
    this.state.data.budgets = [];
    this.state.data.recurringRules = [];
    this.state.data.savingsGoals = [];
    this.persist();
    this.notify();
  }

  public resetToBlank() {
    this.state.data.transactions = [];
    this.state.data.budgets = [];
    this.state.data.recurringRules = [];
    this.state.data.savingsGoals = [];
    this.persist();
    this.notify();
    this.showToast('Reset to blank');
  }

  public loadSampleData() {
    const previousData = JSON.parse(JSON.stringify(this.state.data));
    const today = new Date();
    const ym = getCurrentYearMonth(today);
    const mStr = String(ym.month + 1).padStart(2, '0');
    const yStr = String(ym.year);

    const prevYM = addMonths(ym, -1);
    const pmStr = String(prevYM.month + 1).padStart(2, '0');
    const pyStr = String(prevYM.year);

    const sampleTransactions: Transaction[] = [
      // Past month
      { id: 's-p1', date: `${pyStr}-${pmStr}-01`, amount: 480000, type: 'income', category: 'salary', description: 'Tech Monthly Salary', createdAt: Date.now() - 35 * 86400000 },
      { id: 's-p2', date: `${pyStr}-${pmStr}-05`, amount: 120000, type: 'expense', category: 'housing', description: 'Apartment Rent', createdAt: Date.now() - 34 * 86400000 },
      { id: 's-p3', date: `${pyStr}-${pmStr}-10`, amount: 45000, type: 'expense', category: 'groceries', description: 'Supermarket Groceries', createdAt: Date.now() - 30 * 86400000 },
      { id: 's-p4', date: `${pyStr}-${pmStr}-18`, amount: 18000, type: 'expense', category: 'food', description: 'Weekend Sushi Dinner', createdAt: Date.now() - 25 * 86400000 },
      // Current month
      { id: 's-c1', date: `${yStr}-${mStr}-01`, amount: 480000, type: 'income', category: 'salary', description: 'Tech Monthly Salary', createdAt: Date.now() - 15 * 86400000 },
      { id: 's-c2', date: `${yStr}-${mStr}-02`, amount: 120000, type: 'expense', category: 'housing', description: 'Apartment Rent', createdAt: Date.now() - 14 * 86400000 },
      { id: 's-c3', date: `${yStr}-${mStr}-04`, amount: 8500, type: 'expense', category: 'utilities', description: 'Electricity & Gas bill', createdAt: Date.now() - 12 * 86400000 },
      { id: 's-c4', date: `${yStr}-${mStr}-06`, amount: 35000, type: 'expense', category: 'groceries', description: 'Weekly groceries & produce', createdAt: Date.now() - 10 * 86400000 },
      { id: 's-c5', date: `${yStr}-${mStr}-08`, amount: 24000, type: 'expense', category: 'food', description: 'Dinner with colleagues', createdAt: Date.now() - 8 * 86400000 },
      { id: 's-c6', date: `${yStr}-${mStr}-11`, amount: 95000, type: 'income', category: 'freelance', description: 'UI Design Consulting', createdAt: Date.now() - 5 * 86400000 },
      { id: 's-c7', date: `${yStr}-${mStr}-12`, amount: 1450, type: 'expense', category: 'entertainment', description: 'Streaming subscription', createdAt: Date.now() - 4 * 86400000 },
      { id: 's-c8', date: `${yStr}-${mStr}-14`, amount: 6200, type: 'expense', category: 'transport', description: 'Train transit pass', createdAt: Date.now() - 2 * 86400000 },
    ];

    const sampleBudgets: Budget[] = [
      { id: 'sb-1', category: 'food', limit: 30000, rollover: true },
      { id: 'sb-2', category: 'groceries', limit: 45000, rollover: true },
      { id: 'sb-3', category: 'entertainment', limit: 10000, rollover: false },
      { id: 'sb-4', category: 'transport', limit: 12000, rollover: false },
    ];

    const sampleGoals: SavingsGoal[] = [
      { id: 'sg-1', name: 'Emergency Safety Fund', targetAmount: 1000000, currentAmount: 650000, targetDate: `${ym.year}-12-31`, emoji: '🛡️' },
      { id: 'sg-2', name: 'Kyoto Vacation', targetAmount: 350000, currentAmount: 220000, targetDate: `${ym.year + 1}-05-01`, emoji: '✈️' },
    ];

    const sampleRecurring: RecurringRule[] = [
      { id: 'sr-1', frequency: 'monthly', amount: 480000, type: 'income', category: 'salary', description: 'Monthly Tech Salary', startDate: `${yStr}-${mStr}-01`, paused: false },
      { id: 'sr-2', frequency: 'monthly', amount: 1450, type: 'expense', category: 'entertainment', description: 'Streaming subscription', startDate: `${yStr}-${mStr}-12`, paused: false },
    ];

    this.state.data.transactions = sampleTransactions;
    this.state.data.budgets = sampleBudgets;
    this.state.data.savingsGoals = sampleGoals;
    this.state.data.recurringRules = sampleRecurring;

    this.persist();
    this.notify();
    this.showToast('Sample data loaded', () => {
      this.state.data = previousData;
      this.persist();
      this.notify();
      this.showToast('Restored previous data');
    });
  }
}

export const store = new Store();
