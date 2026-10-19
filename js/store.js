// js/store.js
// Central reactive state store with subscribe/notify pattern.
// Handles single source of truth, undo history, sorting, filters, and recurring transaction generation.

import { loadStateFromStorage, saveStateToStorage, DEFAULT_CATEGORIES } from './storage.js';
import { getCurrentYearMonth, addMonths, getLocalTodayString } from './dates.js';

class Store {
  constructor() {
    this.listeners = new Set();
    this.undoStack = []; // Store operations that can be undone
    
    // Core persistent data
    const saved = loadStateFromStorage();
    this.state = {
      transactions: saved.transactions || [],
      budgets: saved.budgets || [],
      categories: saved.categories || [...DEFAULT_CATEGORIES],
      recurring: saved.recurring || [],
      goals: saved.goals || [],
      settings: saved.settings || { currency: 'USD', theme: 'system' },
      descriptionCategoryMap: saved.descriptionCategoryMap || {},
      
      // Transient UI state (never persisted to localStorage - Bug 7 fix)
      ui: {
        activeView: 'dashboard', // 'dashboard' | 'transactions' | 'budgets' | 'goals' | 'recurring' | 'categories' | 'settings'
        viewedYearMonth: getCurrentYearMonth(), // { year, month } - Bug 4 fix
        filterType: 'all', // 'all' | 'income' | 'expense' | 'month'
        searchQuery: '',
        dateRange: { start: '', end: '' }, // Phase 2: custom date filter
        sortBy: 'date-desc', // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
        currentPage: 1,
        pageSize: 15,
        selectedCalendarDay: null, // Selected day in month/day picker
        toast: null, // { message, undoAction, duration }
      }
    };

    // Process recurring transactions upon store initialization
    this.processRecurringTransactions();
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all subscribers
  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  // Persist only core data & notify
  commit() {
    saveStateToStorage(this.state);
    this.notify();
  }

  // Get current state snapshot
  getState() {
    return this.state;
  }

  // --- UI State Mutations ---
  setView(viewName) {
    this.state.ui.activeView = viewName;
    this.notify();
  }

  changeMonth(delta) {
    this.state.ui.viewedYearMonth = addMonths(this.state.ui.viewedYearMonth, delta);
    this.state.ui.selectedCalendarDay = null;
    this.notify();
  }

  setViewedMonth(yearMonth, day = null) {
    this.state.ui.viewedYearMonth = { year: yearMonth.year, month: yearMonth.month };
    this.state.ui.selectedCalendarDay = day;
    this.notify();
  }

  setFilter(filterType) {
    this.state.ui.filterType = filterType;
    this.state.ui.currentPage = 1;
    this.notify();
  }

  setSearchQuery(query) {
    this.state.ui.searchQuery = query;
    this.state.ui.currentPage = 1;
    this.notify();
  }

  setDateRange(start, end) {
    this.state.ui.dateRange = { start, end };
    this.state.ui.currentPage = 1;
    this.notify();
  }

  setSortBy(sortBy) {
    this.state.ui.sortBy = sortBy;
    this.notify();
  }

  setPage(page) {
    this.state.ui.currentPage = page;
    this.notify();
  }

  setCurrency(currCode) {
    this.state.settings.currency = currCode;
    this.commit();
  }

  setTheme(theme) {
    this.state.settings.theme = theme;
    this.commit();
  }

  // --- Toast & Undo System ---
  showToast(message, undoAction = null, duration = 4000) {
    this.state.ui.toast = {
      message,
      undoAction,
      id: Date.now(),
    };
    this.notify();

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.clearToast();
    }, duration);
  }

  clearToast() {
    this.state.ui.toast = null;
    this.notify();
  }

  triggerUndo() {
    if (this.state.ui.toast && this.state.ui.toast.undoAction) {
      this.state.ui.toast.undoAction();
      this.clearToast();
    }
  }

  // --- Transactions Operations (Add, Edit, Delete with Undo) ---
  addTransaction(txn) {
    const id = txn.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTxn = {
      id,
      date: txn.date || getLocalTodayString(),
      amount: Math.round(txn.amount), // Minor units
      type: txn.type === 'income' ? 'income' : 'expense',
      category: txn.category || 'other',
      description: (txn.description || '').trim() || (txn.type === 'income' ? 'Income' : 'Expense'),
      recurringRuleId: txn.recurringRuleId || null,
    };

    // Update Quick-Add memory: remember last category used for this description
    if (newTxn.description) {
      this.state.descriptionCategoryMap[newTxn.description.toLowerCase()] = newTxn.category;
    }

    this.state.transactions.unshift(newTxn);
    this.commit();

    this.showToast('Transaction added', () => {
      this.state.transactions = this.state.transactions.filter(t => t.id !== id);
      this.commit();
    });
  }

  updateTransaction(id, updatedFields) {
    const idx = this.state.transactions.findIndex(t => t.id === id);
    if (idx === -1) return;

    const previous = { ...this.state.transactions[idx] };
    this.state.transactions[idx] = {
      ...previous,
      ...updatedFields,
      amount: Math.round(updatedFields.amount !== undefined ? updatedFields.amount : previous.amount),
    };

    if (updatedFields.description) {
      this.state.descriptionCategoryMap[updatedFields.description.toLowerCase()] = this.state.transactions[idx].category;
    }

    this.commit();

    this.showToast('Transaction updated', () => {
      this.state.transactions[idx] = previous;
      this.commit();
    });
  }

  deleteTransaction(id) {
    const idx = this.state.transactions.findIndex(t => t.id === id);
    if (idx === -1) return;

    const deleted = this.state.transactions[idx];
    this.state.transactions.splice(idx, 1);
    this.commit();

    this.showToast('Transaction deleted', () => {
      this.state.transactions.splice(idx, 0, deleted);
      this.commit();
    });
  }

  // --- Budgets Operations (Add, Edit, Delete with Undo, Rollover) ---
  setBudget(category, limitMinor, rollover = false) {
    const existingIdx = this.state.budgets.findIndex(b => b.category === category);
    const prev = existingIdx !== -1 ? { ...this.state.budgets[existingIdx] } : null;

    if (existingIdx !== -1) {
      this.state.budgets[existingIdx] = {
        ...this.state.budgets[existingIdx],
        limit: Math.round(limitMinor),
        rollover: Boolean(rollover),
      };
    } else {
      this.state.budgets.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category,
        limit: Math.round(limitMinor),
        rollover: Boolean(rollover),
      });
    }

    this.commit();

    this.showToast('Budget saved', () => {
      if (prev) {
        this.state.budgets[existingIdx] = prev;
      } else {
        this.state.budgets = this.state.budgets.filter(b => b.category !== category);
      }
      this.commit();
    });
  }

  deleteBudget(id) {
    const idx = this.state.budgets.findIndex(b => b.id === id);
    if (idx === -1) return;

    const deleted = this.state.budgets[idx];
    this.state.budgets.splice(idx, 1);
    this.commit();

    this.showToast('Budget deleted', () => {
      this.state.budgets.splice(idx, 0, deleted);
      this.commit();
    });
  }

  // --- Custom Categories Management ---
  addCategory({ id, name, emoji, color, isIncome = false }) {
    const catId = id || name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (this.state.categories.some(c => c.id === catId)) {
      throw new Error('Category already exists');
    }
    const newCat = { id: catId, name, emoji: emoji || '📦', color: color || '#3D3AFF', isIncome };
    this.state.categories.push(newCat);
    this.commit();
    this.showToast(`Category "${name}" created`);
    return newCat;
  }

  updateCategory(id, { name, emoji, color }) {
    const cat = this.state.categories.find(c => c.id === id);
    if (!cat) return;
    if (name) cat.name = name;
    if (emoji) cat.emoji = emoji;
    if (color) cat.color = color;
    this.commit();
    this.showToast(`Category updated`);
  }

  deleteCategory(id, reassignToCatId = 'other') {
    if (id === 'other') return; // Cannot delete fallback 'other'
    // Reassign transactions
    this.state.transactions.forEach(t => {
      if (t.category === id) {
        t.category = reassignToCatId;
      }
    });
    // Remove category
    this.state.categories = this.state.categories.filter(c => c.id !== id);
    // Remove budget for this category
    this.state.budgets = this.state.budgets.filter(b => b.category !== id);
    this.commit();
    this.showToast('Category deleted and transactions reassigned');
  }

  // --- Savings Goals ---
  addGoal({ name, targetAmountMinor, targetDate, initialSavedMinor = 0, emoji = '🎯' }) {
    const goal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      targetAmount: Math.round(targetAmountMinor),
      savedAmount: Math.round(initialSavedMinor),
      targetDate: targetDate || '',
      emoji: emoji || '🎯',
      createdAt: getLocalTodayString(),
    };
    this.state.goals.push(goal);
    this.commit();
    this.showToast('Savings goal created');
    return goal;
  }

  updateGoal(id, updates) {
    const goal = this.state.goals.find(g => g.id === id);
    if (!goal) return;
    Object.assign(goal, updates);
    this.commit();
    this.showToast('Goal updated');
  }

  contributeToGoal(id, amountMinor) {
    const goal = this.state.goals.find(g => g.id === id);
    if (!goal) return;
    goal.savedAmount = Math.max(0, goal.savedAmount + Math.round(amountMinor));
    this.commit();
    this.showToast(`Contributed to ${goal.name}`);
  }

  deleteGoal(id) {
    const idx = this.state.goals.findIndex(g => g.id === id);
    if (idx === -1) return;
    const deleted = this.state.goals[idx];
    this.state.goals.splice(idx, 1);
    this.commit();
    this.showToast('Goal removed', () => {
      this.state.goals.splice(idx, 0, deleted);
      this.commit();
    });
  }

  // --- Recurring Transactions ---
  addRecurringRule({ description, amountMinor, type, category, frequency, startDate }) {
    const rule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description,
      amount: Math.round(amountMinor),
      type: type || 'expense',
      category: category || 'other',
      frequency: frequency || 'monthly', // 'weekly' | 'monthly'
      startDate: startDate || getLocalTodayString(),
      lastGeneratedDate: null,
      isPaused: false,
    };
    this.state.recurring.push(rule);
    this.processRecurringTransactions();
    this.commit();
    this.showToast('Recurring transaction setup');
    return rule;
  }

  togglePauseRecurring(id) {
    const rule = this.state.recurring.find(r => r.id === id);
    if (!rule) return;
    rule.isPaused = !rule.isPaused;
    this.commit();
    this.showToast(rule.isPaused ? 'Recurring rule paused' : 'Recurring rule active');
  }

  deleteRecurring(id) {
    this.state.recurring = this.state.recurring.filter(r => r.id !== id);
    this.commit();
    this.showToast('Recurring rule deleted');
  }

  /**
   * Automatically generate recurring transactions up to today if not yet created
   */
  processRecurringTransactions() {
    const today = getLocalTodayString();
    let generatedCount = 0;

    for (const rule of this.state.recurring) {
      if (rule.isPaused) continue;

      let nextDue = rule.lastGeneratedDate || rule.startDate;
      // If never generated and start date is in future, don't generate yet
      if (!rule.lastGeneratedDate && rule.startDate > today) continue;

      // Advance by frequency
      while (nextDue <= today) {
        // If lastGeneratedDate was already set, calculate the next instance
        if (rule.lastGeneratedDate) {
          const d = new Date(nextDue + 'T00:00:00');
          if (rule.frequency === 'weekly') {
            d.setDate(d.getDate() + 7);
          } else {
            d.setMonth(d.getMonth() + 1);
          }
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          nextDue = `${y}-${m}-${day}`;
          if (nextDue > today) break;
        }

        // Create transaction
        const txnId = `rec-${rule.id}-${nextDue}`;
        const alreadyExists = this.state.transactions.some(t => t.id === txnId);
        if (!alreadyExists) {
          this.state.transactions.push({
            id: txnId,
            date: nextDue,
            amount: rule.amount,
            type: rule.type,
            category: rule.category,
            description: `${rule.description} (Auto)`,
            recurringRuleId: rule.id,
          });
          generatedCount++;
        }

        rule.lastGeneratedDate = nextDue;
      }
    }

    if (generatedCount > 0) {
      this.commit();
    }
  }

  // --- Import / Export / Reset / Demo Data ---
  importData(incoming, mode = 'merge') {
    // Mode: 'merge' or 'replace' (Bug 8)
    if (mode === 'replace') {
      this.state.transactions = incoming.transactions || [];
      this.state.budgets = incoming.budgets || [];
      if (incoming.categories?.length) this.state.categories = incoming.categories;
      if (incoming.goals?.length) this.state.goals = incoming.goals;
      if (incoming.recurring?.length) this.state.recurring = incoming.recurring;
      if (incoming.settings) this.state.settings = { ...this.state.settings, ...incoming.settings };
    } else {
      // Merge: avoid duplicate IDs
      const existingTxnIds = new Set(this.state.transactions.map(t => t.id));
      (incoming.transactions || []).forEach(t => {
        if (!existingTxnIds.has(t.id)) {
          this.state.transactions.push(t);
        }
      });

      const existingBudgetCats = new Set(this.state.budgets.map(b => b.category));
      (incoming.budgets || []).forEach(b => {
        if (!existingBudgetCats.has(b.category)) {
          this.state.budgets.push(b);
        }
      });

      if (incoming.goals) {
        const goalIds = new Set(this.state.goals.map(g => g.id));
        incoming.goals.forEach(g => {
          if (!goalIds.has(g.id)) this.state.goals.push(g);
        });
      }
    }

    this.commit();
    this.showToast(`Data imported successfully (${mode === 'merge' ? 'Merged' : 'Replaced'})`);
  }

  clearAllData() {
    const prevTransactions = [...this.state.transactions];
    const prevBudgets = [...this.state.budgets];
    const prevGoals = [...this.state.goals];
    const prevRecurring = [...this.state.recurring];

    this.state.transactions = [];
    this.state.budgets = [];
    this.state.goals = [];
    this.state.recurring = [];
    this.commit();

    this.showToast('All data cleared', () => {
      this.state.transactions = prevTransactions;
      this.state.budgets = prevBudgets;
      this.state.goals = prevGoals;
      this.state.recurring = prevRecurring;
      this.commit();
    });
  }

  loadDemoData() {
    const prevTransactions = [...this.state.transactions];
    const prevBudgets = [...this.state.budgets];
    const prevGoals = [...this.state.goals];
    const prevRecurring = [...this.state.recurring];

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    this.state.transactions = [
      { id: 'demo-1', date: `${y}-${m}-01`, amount: 450000, type: 'income', category: 'salary', description: 'Monthly Salary' },
      { id: 'demo-2', date: `${y}-${m}-02`, amount: 120000, type: 'expense', category: 'housing', description: 'Apartment Rent' },
      { id: 'demo-3', date: `${y}-${m}-04`, amount: 1540, type: 'expense', category: 'food', description: 'Coffee & Bagel' },
      { id: 'demo-4', date: `${y}-${m}-06`, amount: 8420, type: 'expense', category: 'groceries', description: 'Supermarket Groceries' },
      { id: 'demo-5', date: `${y}-${m}-08`, amount: 6500, type: 'expense', category: 'utilities', description: 'High-speed Internet & Power' },
      { id: 'demo-6', date: `${y}-${m}-11`, amount: 3200, type: 'expense', category: 'transport', description: 'Metro Card Pass' },
      { id: 'demo-7', date: `${y}-${m}-13`, amount: 4890, type: 'expense', category: 'entertainment', description: 'Concert & Streaming' },
      { id: 'demo-8', date: `${y}-${m}-15`, amount: 75000, type: 'income', category: 'freelance', description: 'Web Consulting' },
      { id: 'demo-9', date: `${y}-${m}-16`, amount: 12500, type: 'expense', category: 'shopping', description: 'Ergonomic Desk Chair' },
    ];

    this.state.budgets = [
      { id: 'b-1', category: 'food', limit: 30000, rollover: true },
      { id: 'b-2', category: 'groceries', limit: 40000, rollover: false },
      { id: 'b-3', category: 'entertainment', limit: 15000, rollover: false },
      { id: 'b-4', category: 'shopping', limit: 20000, rollover: false },
    ];

    this.state.goals = [
      { id: 'g-1', name: 'Emergency Fund', targetAmount: 500000, savedAmount: 320000, targetDate: `${y}-12-31`, emoji: '🛡️', createdAt: `${y}-01-01` },
      { id: 'g-2', name: 'MacBook Pro Upgrade', targetAmount: 200000, savedAmount: 145000, targetDate: `${y}-11-15`, emoji: '💻', createdAt: `${y}-02-01` },
    ];

    this.state.recurring = [
      { id: 'r-1', description: 'Netflix Subscription', amount: 1599, type: 'expense', category: 'entertainment', frequency: 'monthly', startDate: `${y}-01-01`, isPaused: false, lastGeneratedDate: `${y}-${m}-01` },
    ];

    this.commit();
    this.showToast('Demo data loaded successfully!', () => {
      this.state.transactions = prevTransactions;
      this.state.budgets = prevBudgets;
      this.state.goals = prevGoals;
      this.state.recurring = prevRecurring;
      this.commit();
    });
  }
}

export const store = new Store();
