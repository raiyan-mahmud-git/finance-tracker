// js/main.js
// Main entrypoint for Flo personal finance tracker.
// Wires store, views, modals, undo toast, keyboard shortcuts, PWA registration, and theme handling.

import { store } from './store.js';
import { formatMonthYear, getLocalTodayString } from './dates.js';
import { getCurrencyConfig, toMinorUnits, toMajorUnits } from './money.js';
import { exportToCsv, parseFromCsv } from './csv.js';
import { validateImportPayload } from './storage.js';
import {
  renderDashboardView,
  renderTransactionsView,
  renderBudgetsView,
  renderGoalsView,
  renderRecurringView,
  renderCategoriesView,
  renderSettingsView,
  renderCalendarDropdown,
  escapeHtml,
} from './views.js';

class FloApp {
  constructor() {
    this.initElements();
    this.initTheme();
    this.bindEvents();

    // Subscribe to store updates
    store.subscribe((state) => this.render(state));

    // Register Service Worker for PWA offline support
    this.registerServiceWorker();

    // Initial render
    this.render(store.getState());
  }

  initElements() {
    this.currentMonthLabel = document.getElementById('currentMonthLabel');
    this.pageTitle = document.getElementById('pageTitle');
    this.sidebar = document.getElementById('sidebar');
    this.sidebarOverlay = document.getElementById('sidebarOverlay');
    this.calendarDropdown = document.getElementById('calendarDropdown');
    this.toastContainer = document.getElementById('toastContainer');
    this.toastMessage = document.getElementById('toastMessage');
    this.toastUndoBtn = document.getElementById('toastUndoBtn');

    // Main views container
    this.views = {
      dashboard: document.getElementById('view-dashboard'),
      transactions: document.getElementById('view-transactions'),
      budgets: document.getElementById('view-budgets'),
      goals: document.getElementById('view-goals'),
      recurring: document.getElementById('view-recurring'),
      categories: document.getElementById('view-categories'),
      settings: document.getElementById('view-settings'),
    };

    // Modals
    this.txnModal = document.getElementById('txnModal');
    this.budgetModal = document.getElementById('budgetModal');
    this.goalModal = document.getElementById('goalModal');
    this.recurringModal = document.getElementById('recurringModal');
    this.categoryModal = document.getElementById('categoryModal');
    this.importModal = document.getElementById('importModal');

    // Transaction form elements
    this.txnForm = document.getElementById('txnForm');
    this.txnIdInput = document.getElementById('txnId');
    this.txnTypeExpenseBtn = document.getElementById('typeExpense');
    this.txnTypeIncomeBtn = document.getElementById('typeIncome');
    this.txnAmountInput = document.getElementById('txnAmount');
    this.txnDescInput = document.getElementById('txnDesc');
    this.txnCategorySelect = document.getElementById('txnCategory');
    this.txnDateInput = document.getElementById('txnDate');
    this.txnCurrencyPrefix = document.getElementById('txnCurrencyPrefix');
    this.currentTxnType = 'expense';
  }

  // --- Theme Handling (System, Light, Dark) ---
  initTheme() {
    const savedTheme = store.getState().settings.theme || 'system';
    this.applyTheme(savedTheme);

    // Watch system changes if set to 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (store.getState().settings.theme === 'system') {
        this.applyTheme('system');
      }
    });
  }

  setTheme(theme) {
    store.setTheme(theme);
    this.applyTheme(theme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  applyTheme(theme) {
    let effective = theme;
    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);

    const isDark = effective === 'dark';
    document.querySelectorAll('.theme-toggle-switch').forEach(sw => {
      if (isDark) sw.classList.add('active');
      else sw.classList.remove('active');
    });
  }

  // --- Service Worker Registration ---
  registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  }

  // --- Global Event Bindings ---
  bindEvents() {
    // Nav Items click
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);
        this.closeSidebar();
      });
    });

    // Month Navigation in Header
    document.getElementById('prevMonthBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      store.changeMonth(-1);
    });
    document.getElementById('nextMonthBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      store.changeMonth(1);
    });

    // Calendar toggle
    document.getElementById('monthBadge')?.addEventListener('click', () => {
      this.toggleCalendar();
    });

    // Document click to close dropdowns
    document.addEventListener('click', (e) => {
      const badge = document.getElementById('monthBadge');
      if (this.calendarDropdown && badge && !badge.contains(e.target) && !this.calendarDropdown.contains(e.target)) {
        this.closeCalendar();
      }
    });

    // FAB click
    document.getElementById('fabBtn')?.addEventListener('click', () => {
      this.openAddModal();
    });

    // Sidebar toggles
    document.getElementById('hamburgerBtn')?.addEventListener('click', () => this.toggleSidebar());
    this.sidebarOverlay?.addEventListener('click', () => this.closeSidebar());

    // Modal close buttons & backdrop click
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAllModals();
      });
    });

    // Keyboard Shortcuts (Phase 4):
    // 'N' for new transaction, 'Escape' to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        this.closeCalendar();
        this.closeSidebar();
      } else if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this.openAddModal();
      }
    });

    // Toast Undo button
    this.toastUndoBtn?.addEventListener('click', () => {
      store.triggerUndo();
    });

    // Transaction Type toggle
    this.txnTypeExpenseBtn?.addEventListener('click', () => this.setTxnType('expense'));
    this.txnTypeIncomeBtn?.addEventListener('click', () => this.setTxnType('income'));

    // Transaction Description input - Quick-Add category remember
    this.txnDescInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      const remembered = store.getState().descriptionCategoryMap[val];
      if (remembered && this.txnCategorySelect) {
        this.txnCategorySelect.value = remembered;
      }
    });

    // Transaction Form submit
    this.txnForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTransaction();
    });

    // Budget Form submit
    document.getElementById('budgetForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveBudget();
    });

    // Goal Form submit
    document.getElementById('goalForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveGoal();
    });

    // Recurring Form submit
    document.getElementById('recurringForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecurring();
    });

    // Category Form submit
    document.getElementById('categoryForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCategory();
    });
  }

  // --- Navigation & Views ---
  switchView(viewName) {
    store.setView(viewName);
  }

  toggleSidebar() {
    this.sidebar?.classList.toggle('open');
    this.sidebarOverlay?.classList.toggle('open');
  }

  closeSidebar() {
    this.sidebar?.classList.remove('open');
    this.sidebarOverlay?.classList.remove('open');
  }

  toggleCalendar() {
    if (this.calendarDropdown.style.display === 'none' || !this.calendarDropdown.style.display) {
      renderCalendarDropdown(this.calendarDropdown, store.getState());
      this.calendarDropdown.style.display = 'block';
    } else {
      this.closeCalendar();
    }
  }

  closeCalendar() {
    if (this.calendarDropdown) this.calendarDropdown.style.display = 'none';
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  // --- Modals Management ---
  openAddModal() {
    const state = store.getState();
    const currConf = getCurrencyConfig(state.settings.currency);

    this.txnIdInput.value = '';
    document.getElementById('txnModalTitle').textContent = 'Add Transaction';
    this.setTxnType('expense');
    this.txnAmountInput.value = '';
    this.txnDescInput.value = '';
    this.txnDateInput.value = getLocalTodayString(); // Bug 5 fix: local today
    this.txnCurrencyPrefix.textContent = currConf.symbol;

    this.populateCategorySelect('expense');

    this.txnModal.classList.add('open');
    // Quick-Add: autofocus amount field
    setTimeout(() => this.txnAmountInput.focus(), 50);
  }

  openEditModal(txn) {
    const state = store.getState();
    const currConf = getCurrencyConfig(state.settings.currency);

    this.txnIdInput.value = txn.id;
    document.getElementById('txnModalTitle').textContent = 'Edit Transaction';
    this.setTxnType(txn.type);
    this.txnAmountInput.value = toMajorUnits(txn.amount, state.settings.currency);
    this.txnDescInput.value = txn.description || '';
    this.txnDateInput.value = txn.date;
    this.txnCurrencyPrefix.textContent = currConf.symbol;

    this.populateCategorySelect(txn.type);
    this.txnCategorySelect.value = txn.category;

    this.txnModal.classList.add('open');
    setTimeout(() => this.txnAmountInput.focus(), 50);
  }

  setTxnType(type) {
    this.currentTxnType = type;
    if (type === 'income') {
      this.txnTypeIncomeBtn.className = 'type-btn active-income';
      this.txnTypeExpenseBtn.className = 'type-btn';
    } else {
      this.txnTypeExpenseBtn.className = 'type-btn active-expense';
      this.txnTypeIncomeBtn.className = 'type-btn';
    }
    this.populateCategorySelect(type);
  }

  populateCategorySelect(type) {
    const categories = store.getState().categories;
    const filtered = categories.filter(c => type === 'income' ? c.isIncome : !c.isIncome);
    this.txnCategorySelect.innerHTML = filtered.map(c => `
      <option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>
    `).join('');
  }

  saveTransaction() {
    const id = this.txnIdInput.value;
    const amountVal = parseFloat(this.txnAmountInput.value);
    const desc = this.txnDescInput.value.trim();
    const category = this.txnCategorySelect.value;
    const date = this.txnDateInput.value;
    const currency = store.getState().settings.currency;

    if (isNaN(amountVal) || amountVal <= 0 || !date) return;

    const amountMinor = toMinorUnits(amountVal, currency);

    if (id) {
      store.updateTransaction(id, {
        amount: amountMinor,
        description: desc,
        category,
        date,
        type: this.currentTxnType,
      });
    } else {
      store.addTransaction({
        amount: amountMinor,
        description: desc,
        category,
        date,
        type: this.currentTxnType,
      });
    }

    this.closeAllModals();
  }

  openBudgetModal(editBudget = null) {
    const state = store.getState();
    const currConf = getCurrencyConfig(state.settings.currency);
    const catSelect = document.getElementById('budgetCategory');
    const limitInput = document.getElementById('budgetLimit');
    const rolloverCheckbox = document.getElementById('budgetRollover');
    const prefix = document.getElementById('budgetCurrencyPrefix');
    const title = document.getElementById('budgetModalTitle');

    prefix.textContent = currConf.symbol;

    // Filter only expense categories
    const expenseCats = state.categories.filter(c => !c.isIncome);
    catSelect.innerHTML = expenseCats.map(c => `
      <option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>
    `).join('');

    if (editBudget) {
      title.textContent = 'Edit Budget';
      catSelect.value = editBudget.category;
      limitInput.value = toMajorUnits(editBudget.limit, state.settings.currency);
      rolloverCheckbox.checked = Boolean(editBudget.rollover);
    } else {
      title.textContent = 'New Budget';
      limitInput.value = '';
      rolloverCheckbox.checked = false;
    }

    this.budgetModal.classList.add('open');
    setTimeout(() => limitInput.focus(), 50);
  }

  saveBudget() {
    const cat = document.getElementById('budgetCategory').value;
    const limitMajor = parseFloat(document.getElementById('budgetLimit').value);
    const rollover = document.getElementById('budgetRollover').checked;
    const currency = store.getState().settings.currency;

    if (isNaN(limitMajor) || limitMajor <= 0) return;

    store.setBudget(cat, toMinorUnits(limitMajor, currency), rollover);
    this.closeAllModals();
  }

  openGoalModal() {
    const currConf = getCurrencyConfig(store.getState().settings.currency);
    document.getElementById('goalCurrencyPrefix').textContent = currConf.symbol;
    document.getElementById('goalName').value = '';
    document.getElementById('goalTarget').value = '';
    document.getElementById('goalCurrent').value = '0';
    document.getElementById('goalDate').value = '';

    this.goalModal.classList.add('open');
    setTimeout(() => document.getElementById('goalName').focus(), 50);
  }

  saveGoal() {
    const name = document.getElementById('goalName').value.trim();
    const targetMajor = parseFloat(document.getElementById('goalTarget').value);
    const currentMajor = parseFloat(document.getElementById('goalCurrent').value) || 0;
    const targetDate = document.getElementById('goalDate').value;
    const emoji = document.getElementById('goalEmoji').value || '🎯';
    const currency = store.getState().settings.currency;

    if (!name || isNaN(targetMajor) || targetMajor <= 0) return;

    store.addGoal({
      name,
      targetAmountMinor: toMinorUnits(targetMajor, currency),
      initialSavedMinor: toMinorUnits(currentMajor, currency),
      targetDate,
      emoji,
    });

    this.closeAllModals();
  }

  openRecurringModal() {
    const currConf = getCurrencyConfig(store.getState().settings.currency);
    document.getElementById('recCurrencyPrefix').textContent = currConf.symbol;
    document.getElementById('recDesc').value = '';
    document.getElementById('recAmount').value = '';
    document.getElementById('recStartDate').value = getLocalTodayString();

    const catSelect = document.getElementById('recCategory');
    catSelect.innerHTML = store.getState().categories.map(c => `
      <option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>
    `).join('');

    this.recurringModal.classList.add('open');
    setTimeout(() => document.getElementById('recDesc').focus(), 50);
  }

  saveRecurring() {
    const desc = document.getElementById('recDesc').value.trim();
    const amountMajor = parseFloat(document.getElementById('recAmount').value);
    const type = document.getElementById('recType').value;
    const category = document.getElementById('recCategory').value;
    const frequency = document.getElementById('recFrequency').value;
    const startDate = document.getElementById('recStartDate').value;
    const currency = store.getState().settings.currency;

    if (!desc || isNaN(amountMajor) || amountMajor <= 0 || !startDate) return;

    store.addRecurringRule({
      description: desc,
      amountMinor: toMinorUnits(amountMajor, currency),
      type,
      category,
      frequency,
      startDate,
    });

    this.closeAllModals();
  }

  openCategoryModal(editCat = null) {
    const nameInput = document.getElementById('catName');
    const emojiInput = document.getElementById('catEmoji');
    const colorInput = document.getElementById('catColor');
    const incomeInput = document.getElementById('catIsIncome');
    const title = document.getElementById('catModalTitle');
    const idInput = document.getElementById('catEditId');

    if (editCat) {
      title.textContent = 'Edit Category';
      idInput.value = editCat.id;
      nameInput.value = editCat.name;
      emojiInput.value = editCat.emoji;
      colorInput.value = editCat.color;
      incomeInput.disabled = true; // Don't change type on edit
    } else {
      title.textContent = 'New Category';
      idInput.value = '';
      nameInput.value = '';
      emojiInput.value = '🛍️';
      colorInput.value = '#3D3AFF';
      incomeInput.disabled = false;
      incomeInput.checked = false;
    }

    this.categoryModal.classList.add('open');
    setTimeout(() => nameInput.focus(), 50);
  }

  saveCategory() {
    const id = document.getElementById('catEditId').value;
    const name = document.getElementById('catName').value.trim();
    const emoji = document.getElementById('catEmoji').value.trim() || '📦';
    const color = document.getElementById('catColor').value;
    const isIncome = document.getElementById('catIsIncome').checked;

    if (!name) return;

    if (id) {
      store.updateCategory(id, { name, emoji, color });
    } else {
      store.addCategory({ name, emoji, color, isIncome });
    }

    this.closeAllModals();
  }

  // --- Data Management (Export / Import / Demo / Clear) ---
  exportJson() {
    const state = store.getState();
    const exportData = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      transactions: state.transactions,
      budgets: state.budgets,
      categories: state.categories,
      goals: state.goals,
      recurring: state.recurring,
      settings: state.settings,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flo-backup-${getLocalTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    store.showToast('JSON export downloaded');
  }

  exportCsv() {
    const state = store.getState();
    const csvString = exportToCsv(state.transactions, state.settings.currency);

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flo-transactions-${getLocalTodayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    store.showToast('CSV export downloaded (Excel ready)');
  }

  triggerFileImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const isCsv = file.name.endsWith('.csv');
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const content = event.target.result;
          let parsedData = null;

          if (isCsv) {
            const txns = parseFromCsv(content, store.getState().settings.currency);
            parsedData = {
              transactions: txns,
              budgets: [],
            };
          } else {
            parsedData = JSON.parse(content);
          }

          const validation = validateImportPayload(parsedData);
          if (!validation.valid) {
            alert('Import Error: ' + validation.error);
            return;
          }

          this.showImportPreviewModal(validation.preview, parsedData);
        } catch (err) {
          alert('Could not parse file: ' + err.message);
        }
      };

      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }

  showImportPreviewModal(preview, data) {
    const descEl = document.getElementById('importPreviewText');
    descEl.textContent = `File contains ${preview.transactionCount} transactions, ${preview.budgetCount} budgets, ${preview.categoryCount} categories, and ${preview.goalsCount} goals. How would you like to import it?`;

    // Hook up buttons
    const mergeBtn = document.getElementById('importMergeBtn');
    const replaceBtn = document.getElementById('importReplaceBtn');

    mergeBtn.onclick = () => {
      store.importData(data, 'merge');
      this.closeAllModals();
    };

    replaceBtn.onclick = () => {
      if (confirm('Replacing will overwrite your existing data. Proceed?')) {
        store.importData(data, 'replace');
        this.closeAllModals();
      }
    };

    this.importModal.classList.add('open');
  }

  loadDemo() {
    store.loadDemoData();
  }

  clearData() {
    if (confirm('Clear all your transactions and budgets? You can click "Undo" on the notification immediately after if you change your mind.')) {
      store.clearAllData();
    }
  }

  // --- Master Render Function (Pure read from Store) ---
  render(state) {
    const { ui } = state;

    // 1. Update Month Label
    this.currentMonthLabel.textContent = formatMonthYear(ui.viewedYearMonth);

    // 2. Update Page Title & Active View
    const titles = {
      dashboard: 'Dashboard',
      transactions: 'Transactions',
      budgets: 'Budgets',
      goals: 'Savings Goals',
      recurring: 'Recurring Rules',
      categories: 'Categories',
      settings: 'Settings',
    };
    this.pageTitle.textContent = titles[ui.activeView] || 'Flo';

    // Switch active view container
    Object.entries(this.views).forEach(([vName, el]) => {
      if (vName === ui.activeView) {
        el.classList.add('active');
        // Render specific view
        if (vName === 'dashboard') renderDashboardView(el, state);
        else if (vName === 'transactions') renderTransactionsView(el, state);
        else if (vName === 'budgets') renderBudgetsView(el, state);
        else if (vName === 'goals') renderGoalsView(el, state);
        else if (vName === 'recurring') renderRecurringView(el, state);
        else if (vName === 'categories') renderCategoriesView(el, state);
        else if (vName === 'settings') renderSettingsView(el, state);
      } else {
        el.classList.remove('active');
      }
    });

    // 3. Update Sidebar & Mobile Navigation active state
    document.querySelectorAll('[data-view]').forEach(item => {
      if (item.dataset.view === ui.activeView) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });

    // 4. Update Toast Banner
    if (ui.toast) {
      this.toastMessage.textContent = ui.toast.message;
      if (ui.toast.undoAction) {
        this.toastUndoBtn.style.display = 'inline-block';
      } else {
        this.toastUndoBtn.style.display = 'none';
      }
      this.toastContainer.classList.add('visible');
    } else {
      this.toastContainer.classList.remove('visible');
    }
  }
}

// Instantiate and expose app for inline event handlers and tests
window.floApp = new FloApp();
