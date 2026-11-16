import './index.css';
import { getTodayLocalDateString } from './modules/dates.ts';
import { exportTransactionsToCSV, parseTransactionsFromCSV, validateAndPreviewJSON, mergeData, ImportPreview } from './modules/importExport.ts';
import { fromMinorUnits, toMinorUnits } from './modules/money.ts';
import { store, AppState } from './modules/store.ts';
import { renderNavbar } from './modules/components/Navbar.ts';
import { renderMobileBottomBar } from './modules/components/MobileBottomBar.ts';
import { initModals, closeDialog } from './modules/components/Modals.ts';
import { renderDashboardView } from './modules/views/DashboardView.ts';
import { renderTransactionsView } from './modules/views/TransactionsView.ts';
import { renderBudgetsView } from './modules/views/BudgetsView.ts';
import { renderGoalsView } from './modules/views/GoalsView.ts';
import { renderSettingsView } from './modules/views/SettingsView.ts';
import { escapeHtml } from './modules/security.ts';
import type { Category, Transaction } from './modules/types.ts';

let pendingImport: ImportPreview | null = null;
let deferredInstallPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  renderInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  renderInstallButton();
  store.showToast('Flo was successfully installed as an app!');
});

function renderInstallButton() {
  const container = document.getElementById('pwa-install-container');
  if (!container) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  if (isStandalone) {
    container.innerHTML = '';
    return;
  }

  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

  if (deferredInstallPrompt) {
    container.innerHTML = `
      <button class="btn btn-sm" onclick="window.floApp.promptInstall()" style="border-color:var(--indigo); color:var(--indigo); font-weight:700;">
        📥 Install App
      </button>
    `;
  } else if (isIOS) {
    container.innerHTML = `
      <button class="btn btn-sm" onclick="window.floApp.showIOSInstallGuide()" style="font-size:11px;">
        📲 Install (iOS)
      </button>
    `;
  } else {
    container.innerHTML = '';
  }
}

function renderApp(state: AppState) {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const navbarHtml = renderNavbar(state);
  let viewHtml = '';
  switch (state.ui.activeView) {
    case 'dashboard':
      viewHtml = renderDashboardView(state);
      break;
    case 'transactions':
      viewHtml = renderTransactionsView(state);
      break;
    case 'budgets':
      viewHtml = renderBudgetsView(state);
      break;
    case 'goals':
      viewHtml = renderGoalsView(state);
      break;
    case 'settings':
      viewHtml = renderSettingsView(state);
      break;
    default:
      viewHtml = renderDashboardView(state);
  }

  const mobileBarHtml = renderMobileBottomBar(state);

  const toastHtml = state.ui.toast ? `
    <div class="toast-container" role="status" aria-live="polite">
      <div class="toast">
        <span>${escapeHtml(state.ui.toast.message)}</span>
        ${state.ui.toast.undoAction ? `
          <button type="button" class="btn btn-sm" style="background:var(--indigo); color:white; padding:4px 10px; font-weight:700; border-radius:12px;" onclick="window.floApp.executeToastUndo()">
            UNDO
          </button>
          <button type="button" class="toast-dismiss" onclick="window.floApp.dismissToast()" aria-label="Dismiss notification">×</button>
        ` : ''}
      </div>
    </div>
  ` : '<div class="toast-container" role="status" aria-live="polite"></div>';

  const offlineHtml = !navigator.onLine ? `
    <div style="background:var(--amber); color:white; font-size:12px; font-weight:600; text-align:center; padding:6px; position:sticky; top:0; z-index:90;">
      ⚡ Offline Mode — Changes are saved locally to your device.
    </div>
  ` : '';

  appEl.innerHTML = `
    ${offlineHtml}
    <div class="app-layout" style="max-width:1200px; margin:0 auto; padding:0 20px calc(88px + env(safe-area-inset-bottom));">
      ${navbarHtml}
      <main id="main-content" role="main">
        ${viewHtml}
      </main>
      ${mobileBarHtml}
      ${toastHtml}
      <div id="modals-container"></div>
    </div>
  `;

  initModals();
  renderInstallButton();
  updateCategoryDropdowns();
}

function updateCategoryDropdowns() {
  const state = store.getState();
  const cats = state.data.categories;

  const txnCatSel = document.getElementById('txn-category') as HTMLSelectElement | null;
  if (txnCatSel) {
    txnCatSel.innerHTML = cats.map(c => `
      <option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>
    `).join('');
  }

  const budgetCatSel = document.getElementById('budget-category') as HTMLSelectElement | null;
  if (budgetCatSel) {
    budgetCatSel.innerHTML = cats.map(c => `
      <option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>
    `).join('');
  }

  const recCatSel = document.getElementById('rec-category') as HTMLSelectElement | null;
  if (recCatSel) {
    recCatSel.innerHTML = cats.map(c => `
      <option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>
    `).join('');
  }

  const catList = document.getElementById('category-manager-list');
  if (catList) {
    catList.innerHTML = cats.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-soft); font-size:13px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${c.emoji}</span>
          <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(c.name)}</span>
          ${c.isCustom ? '<span style="font-size:10px; background:var(--indigo-light); color:var(--indigo); padding:1px 6px; border-radius:10px;">Custom</span>' : ''}
        </div>
        ${c.isCustom ? `
          <button type="button" class="btn btn-sm btn-danger" onclick="window.floApp.deleteCategoryPrompt('${c.id}')" aria-label="Delete category ${escapeHtml(c.name)}">
            Delete
          </button>
        ` : '<span style="font-size:11px; color:var(--text-muted);">Default</span>'}
      </div>
    `).join('');
  }
}

(window as any).floApp = {
  switchView: (view: any) => store.setView(view),
  changeMonth: (delta: number) => store.changeMonth(delta),
  selectMonth: (monthIdx: number) => {
    const ym = store.getState().ui.viewedYearMonth;
    store.jumpToYearMonth({ year: ym.year, month: monthIdx });
    (window as any).floApp.closeCalendar();
  },
  selectCalendarDay: (day: number) => {
    const ym = store.getState().ui.viewedYearMonth;
    store.jumpToYearMonth(ym, day);
    store.setView('transactions');
    (window as any).floApp.closeCalendar();
  },
  jumpToCurrentMonth: () => {
    const today = new Date();
    store.jumpToYearMonth({ year: today.getFullYear(), month: today.getMonth() }, today.getDate());
    (window as any).floApp.closeCalendar();
  },
  clearDayFilter: () => {
    store.jumpToYearMonth(store.getState().ui.viewedYearMonth, null);
  },
  toggleCalendar: (event: Event) => {
    event.stopPropagation();
    const dropdown = document.getElementById('calendar-dropdown');
    if (dropdown) {
      const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
      dropdown.style.display = isHidden ? 'block' : 'none';
    }
  },
  closeCalendar: () => {
    const dropdown = document.getElementById('calendar-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  },

  closeModal: (id: string) => closeDialog(id),

  getTodayLocalDateString: () => getTodayLocalDateString(),

  fillQuickTxn: (desc: string, cat: string, type: 'expense' | 'income') => {
    const descInput = document.getElementById('txn-desc') as HTMLInputElement;
    const catSelect = document.getElementById('txn-category') as HTMLSelectElement;
    if (descInput) descInput.value = desc;
    if (catSelect && catSelect.querySelector(`option[value="${cat}"]`)) {
      catSelect.value = cat;
    }
    (window as any).floApp.setTxnModalType(type);
    document.getElementById('txn-amount')?.focus();
  },

  resetToBlankData: () => {
    if (confirm('Clear transactions, budgets, and goals to start fresh?')) {
      store.resetToBlank();
    }
  },

  openAddTransactionModal: () => {
    const state = store.getState();
    const dlg = document.getElementById('dlg-transaction') as HTMLDialogElement | null;
    if (!dlg) return;

    document.getElementById('dlg-txn-title')!.textContent = 'Add Transaction';
    (document.getElementById('txn-edit-id') as HTMLInputElement).value = '';
    (document.getElementById('txn-amount') as HTMLInputElement).value = '';
    (document.getElementById('txn-desc') as HTMLInputElement).value = '';
    (document.getElementById('txn-date') as HTMLInputElement).value = getTodayLocalDateString();
    (document.getElementById('txn-currency-prefix') as HTMLElement).textContent = state.data.settings.currency;
    (window as any).floApp.setTxnModalType('expense');

    dlg.showModal();
    setTimeout(() => {
      document.getElementById('txn-amount')?.focus();
    }, 50);
  },

  openEditTransactionModal: (id: string) => {
    const state = store.getState();
    const txn = state.data.transactions.find(t => t.id === id);
    if (!txn) return;

    const dlg = document.getElementById('dlg-transaction') as HTMLDialogElement | null;
    if (!dlg) return;

    document.getElementById('dlg-txn-title')!.textContent = 'Edit Transaction';
    (document.getElementById('txn-edit-id') as HTMLInputElement).value = txn.id;
    (document.getElementById('txn-amount') as HTMLInputElement).value = fromMinorUnits(txn.amount, state.data.settings.currency).toString();
    (document.getElementById('txn-desc') as HTMLInputElement).value = txn.description;
    (document.getElementById('txn-date') as HTMLInputElement).value = txn.date;
    (document.getElementById('txn-currency-prefix') as HTMLElement).textContent = state.data.settings.currency;
    (document.getElementById('txn-category') as HTMLSelectElement).value = txn.category;
    (window as any).floApp.setTxnModalType(txn.type);

    dlg.showModal();
    setTimeout(() => {
      document.getElementById('txn-amount')?.focus();
    }, 50);
  },

  setTxnModalType: (type: 'expense' | 'income') => {
    const typeInput = document.getElementById('txn-type') as HTMLInputElement;
    if (typeInput) typeInput.value = type;

    const btnExp = document.getElementById('btn-type-expense');
    const btnInc = document.getElementById('btn-type-income');
    if (btnExp && btnInc) {
      if (type === 'expense') {
        btnExp.style.background = 'var(--expense)';
        btnExp.style.color = 'white';
        btnExp.style.borderColor = 'var(--expense)';
        btnInc.style.background = 'var(--bg-surface)';
        btnInc.style.color = 'var(--text-primary)';
        btnInc.style.borderColor = 'var(--border-medium)';
      } else {
        btnInc.style.background = 'var(--income)';
        btnInc.style.color = 'white';
        btnInc.style.borderColor = 'var(--income)';
        btnExp.style.background = 'var(--bg-surface)';
        btnExp.style.color = 'var(--text-primary)';
        btnExp.style.borderColor = 'var(--border-medium)';
      }
    }
  },

  onTxnDescInput: (descVal: string) => {
    const key = descVal.trim().toLowerCase();
    const rememberedCategory = store.getState().ui.lastCategoryByDescription[key];
    if (rememberedCategory) {
      const catSelect = document.getElementById('txn-category') as HTMLSelectElement;
      if (catSelect && catSelect.querySelector(`option[value="${rememberedCategory}"]`)) {
        catSelect.value = rememberedCategory;
      }
    }
  },

  handleTxnSubmit: (e: Event) => {
    e.preventDefault();
    const editId = (document.getElementById('txn-edit-id') as HTMLInputElement).value;
    const type = ((document.getElementById('txn-type') as HTMLInputElement).value || 'expense') as 'expense' | 'income';
    const amountVal = parseFloat((document.getElementById('txn-amount') as HTMLInputElement).value);
    const desc = (document.getElementById('txn-desc') as HTMLInputElement).value.trim();
    const category = (document.getElementById('txn-category') as HTMLSelectElement).value;
    const date = (document.getElementById('txn-date') as HTMLInputElement).value;

    if (!amountVal || amountVal <= 0 || !date) return;

    const currency = store.getState().data.settings.currency;
    const minorUnits = toMinorUnits(amountVal, currency);

    if (editId) {
      store.updateTransaction({
        id: editId,
        date,
        amount: minorUnits,
        type,
        category,
        description: desc || (type === 'income' ? 'Income' : 'Expense'),
        createdAt: Date.now(),
      });
      store.showToast('Transaction updated');
    } else {
      store.addTransaction({
        date,
        amount: minorUnits,
        type,
        category,
        description: desc || (type === 'income' ? 'Income' : 'Expense'),
      });
      store.showToast('Transaction saved');
    }

    closeDialog('dlg-transaction');
  },

  deleteTransaction: (id: string) => {
    store.deleteTransaction(id);
  },

  setFilter: (f: any) => store.setFilter(f),
  handleSearchInput: (q: string) => store.setSearchQuery(q),
  handleSortChange: (sort: any) => store.setSortOrder(sort),
  setPage: (p: number) => store.setPage(p),
  toggleCustomDateFilter: () => {
    store.setFilter(store.getState().ui.currentFilter === 'custom' ? 'all' : 'custom');
  },
  setDateFilter: (which: 'start' | 'end', val: string) => {
    const s = store.getState();
    const start = which === 'start' ? val : s.ui.startDateFilter;
    const end = which === 'end' ? val : s.ui.endDateFilter;
    store.setDateRangeFilter(start, end);
  },
  clearDateRangeFilter: () => {
    store.setDateRangeFilter('', '');
    store.setFilter('all');
  },
  resetFilters: () => {
    store.setFilter('all');
    store.setSearchQuery('');
  },

  openAddBudgetModal: () => {
    const dlg = document.getElementById('dlg-budget') as HTMLDialogElement;
    if (!dlg) return;
    (document.getElementById('budget-limit') as HTMLInputElement).value = '';
    (document.getElementById('budget-rollover') as HTMLInputElement).checked = false;
    (document.getElementById('budget-currency-prefix') as HTMLElement).textContent = store.getState().data.settings.currency;
    dlg.showModal();
  },
  openEditBudgetModal: (id: string) => {
    const b = store.getState().data.budgets.find(item => item.id === id);
    if (!b) return;
    const dlg = document.getElementById('dlg-budget') as HTMLDialogElement;
    if (!dlg) return;
    (document.getElementById('budget-category') as HTMLSelectElement).value = b.category;
    (document.getElementById('budget-limit') as HTMLInputElement).value = fromMinorUnits(b.limit, store.getState().data.settings.currency).toString();
    (document.getElementById('budget-rollover') as HTMLInputElement).checked = Boolean(b.rollover);
    (document.getElementById('budget-currency-prefix') as HTMLElement).textContent = store.getState().data.settings.currency;
    dlg.showModal();
  },
  handleBudgetSubmit: (e: Event) => {
    e.preventDefault();
    const cat = (document.getElementById('budget-category') as HTMLSelectElement).value;
    const limitVal = parseFloat((document.getElementById('budget-limit') as HTMLInputElement).value);
    const rollover = (document.getElementById('budget-rollover') as HTMLInputElement).checked;

    if (!limitVal || limitVal <= 0) return;
    const currency = store.getState().data.settings.currency;
    store.saveBudget(cat, toMinorUnits(limitVal, currency), rollover);
    closeDialog('dlg-budget');
    store.showToast(`Budget for "${cat}" saved`);
  },
  deleteBudget: (id: string) => store.deleteBudget(id),

  openCategoryModal: () => {
    const dlg = document.getElementById('dlg-category') as HTMLDialogElement;
    if (dlg) {
      updateCategoryDropdowns();
      dlg.showModal();
    }
  },
  handleCreateCategory: (e: Event) => {
    e.preventDefault();
    const name = (document.getElementById('cat-name') as HTMLInputElement).value.trim();
    const emoji = (document.getElementById('cat-emoji') as HTMLInputElement).value.trim() || '🏷️';
    const color = (document.getElementById('cat-color') as HTMLInputElement).value || '#3D3AFF';

    if (!name) return;
    store.addCategory({ name, emoji, color });
    (document.getElementById('cat-name') as HTMLInputElement).value = '';
    updateCategoryDropdowns();
    store.showToast(`Created category "${name}"`);
  },
  deleteCategoryPrompt: (catId: string) => {
    if (confirm(`Delete this category? Any transactions using it will be safely reassigned to "Other".`)) {
      store.deleteCategory(catId, 'other');
      updateCategoryDropdowns();
    }
  },

  openAddGoalModal: () => {
    const dlg = document.getElementById('dlg-goal') as HTMLDialogElement;
    if (!dlg) return;
    (document.getElementById('goal-edit-id') as HTMLInputElement).value = '';
    (document.getElementById('goal-name') as HTMLInputElement).value = '';
    (document.getElementById('goal-target') as HTMLInputElement).value = '';
    (document.getElementById('goal-current') as HTMLInputElement).value = '0';
    (document.getElementById('goal-date') as HTMLInputElement).value = '';
    (document.getElementById('goal-currency-prefix') as HTMLElement).textContent = store.getState().data.settings.currency;
    (document.getElementById('goal-curr-prefix') as HTMLElement).textContent = store.getState().data.settings.currency;
    dlg.showModal();
  },
  openEditGoalModal: (id: string) => {
    const g = store.getState().data.savingsGoals.find(item => item.id === id);
    if (!g) return;
    const dlg = document.getElementById('dlg-goal') as HTMLDialogElement;
    if (!dlg) return;
    const curr = store.getState().data.settings.currency;
    (document.getElementById('goal-edit-id') as HTMLInputElement).value = g.id;
    (document.getElementById('goal-emoji') as HTMLInputElement).value = g.emoji;
    (document.getElementById('goal-name') as HTMLInputElement).value = g.name;
    (document.getElementById('goal-target') as HTMLInputElement).value = fromMinorUnits(g.targetAmount, curr).toString();
    (document.getElementById('goal-current') as HTMLInputElement).value = fromMinorUnits(g.currentAmount, curr).toString();
    (document.getElementById('goal-date') as HTMLInputElement).value = g.targetDate;
    (document.getElementById('goal-currency-prefix') as HTMLElement).textContent = curr;
    (document.getElementById('goal-curr-prefix') as HTMLElement).textContent = curr;
    dlg.showModal();
  },
  handleGoalSubmit: (e: Event) => {
    e.preventDefault();
    const curr = store.getState().data.settings.currency;
    const editId = (document.getElementById('goal-edit-id') as HTMLInputElement).value;
    const emoji = (document.getElementById('goal-emoji') as HTMLInputElement).value || '🎯';
    const name = (document.getElementById('goal-name') as HTMLInputElement).value.trim();
    const targetVal = parseFloat((document.getElementById('goal-target') as HTMLInputElement).value);
    const currentVal = parseFloat((document.getElementById('goal-current') as HTMLInputElement).value) || 0;
    const targetDate = (document.getElementById('goal-date') as HTMLInputElement).value;

    if (!name || isNaN(targetVal) || targetVal <= 0) return;

    if (editId) {
      store.updateSavingsGoal({
        id: editId,
        emoji,
        name,
        targetAmount: toMinorUnits(targetVal, curr),
        currentAmount: toMinorUnits(currentVal, curr),
        targetDate,
      });
      store.showToast(`Updated savings goal "${name}"`);
    } else {
      store.addSavingsGoal({
        emoji,
        name,
        targetAmount: toMinorUnits(targetVal, curr),
        currentAmount: toMinorUnits(currentVal, curr),
        targetDate,
      });
      store.showToast(`Created savings goal "${name}"`);
    }
    closeDialog('dlg-goal');
  },
  quickContributeToGoal: (id: string) => {
    const goal = store.getState().data.savingsGoals.find(g => g.id === id);
    if (!goal) return;
    const amountStr = prompt(`Enter contribution amount for "${goal.name}":`, '50');
    if (!amountStr) return;
    const val = parseFloat(amountStr);
    if (!isNaN(val) && val > 0) {
      store.contributeToGoal(id, toMinorUnits(val, store.getState().data.settings.currency));
      store.showToast(`Added ${val} to "${goal.name}"`);
    }
  },
  deleteGoal: (id: string) => store.deleteSavingsGoal(id),

  openAddRecurringModal: () => {
    const dlg = document.getElementById('dlg-recurring') as HTMLDialogElement;
    if (!dlg) return;
    (document.getElementById('rec-amount') as HTMLInputElement).value = '';
    (document.getElementById('rec-desc') as HTMLInputElement).value = '';
    (document.getElementById('rec-date') as HTMLInputElement).value = getTodayLocalDateString();
    (document.getElementById('rec-currency-prefix') as HTMLElement).textContent = store.getState().data.settings.currency;
    dlg.showModal();
  },
  handleRecurringSubmit: (e: Event) => {
    e.preventDefault();
    const type = (document.getElementById('rec-type') as HTMLSelectElement).value as any;
    const frequency = (document.getElementById('rec-freq') as HTMLSelectElement).value as any;
    const amountVal = parseFloat((document.getElementById('rec-amount') as HTMLInputElement).value);
    const desc = (document.getElementById('rec-desc') as HTMLInputElement).value.trim();
    const cat = (document.getElementById('rec-category') as HTMLSelectElement).value;
    const date = (document.getElementById('rec-date') as HTMLInputElement).value;

    if (!desc || !amountVal || amountVal <= 0 || !date) return;

    store.addRecurringRule({
      frequency,
      type,
      category: cat,
      description: desc,
      amount: toMinorUnits(amountVal, store.getState().data.settings.currency),
      startDate: date,
      paused: false,
    });
    closeDialog('dlg-recurring');
  },
  togglePauseRecurring: (id: string) => store.togglePauseRecurringRule(id),
  deleteRecurring: (id: string) => store.deleteRecurringRule(id),

  updateCurrency: (c: string) => store.setCurrency(c),
  updateTheme: (t: any) => store.setTheme(t),
  toggleTheme: () => {
    const current = store.getState().data.settings.theme;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    store.setTheme(next);
  },

  exportJSON: () => {
    const data = store.getState().data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flo-backup-${getTodayLocalDateString()}.json`;
    a.click();
    store.showToast('JSON backup downloaded');
  },
  exportCSV: () => {
    const data = store.getState().data;
    const csvContent = exportTransactionsToCSV(data.transactions, data.settings.currency);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flo-transactions-${getTodayLocalDateString()}.csv`;
    a.click();
    store.showToast('CSV with Excel UTF-8 BOM downloaded');
  },
  triggerImportFile: (type: 'json' | 'csv') => {
    const el = document.getElementById(`${type}-file-input`) as HTMLInputElement;
    if (el) {
      el.value = '';
      el.click();
    }
  },
  onJSONFileSelected: (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const preview = validateAndPreviewJSON(text);
      if (!preview.valid) {
        alert(preview.error || 'Invalid JSON format');
        return;
      }
      pendingImport = preview;
      (window as any).floApp.showImportPreview(preview, 'JSON');
    };
    reader.readAsText(file);
  },
  onCSVFileSelected: (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const preview = parseTransactionsFromCSV(text, store.getState().data.settings.currency);
      if (!preview.valid) {
        alert(preview.error || 'Invalid CSV format');
        return;
      }
      pendingImport = preview;
      (window as any).floApp.showImportPreview(preview, 'CSV');
    };
    reader.readAsText(file);
  },
  showImportPreview: (preview: ImportPreview, formatName: string) => {
    const dlg = document.getElementById('dlg-import') as HTMLDialogElement;
    const body = document.getElementById('import-preview-body');
    if (!dlg || !body) return;

    body.innerHTML = `
      <div style="background:var(--bg-base); padding:16px; border-radius:12px; margin-bottom:16px;">
        <div style="font-weight:700; font-size:14px; margin-bottom:8px; color:var(--text-primary);">
          ${formatName} File Verified Successfully
        </div>
        <ul style="font-size:13px; color:var(--text-secondary); line-height:1.7; padding-left:20px;">
          <li><strong>${preview.transactionCount}</strong> transactions ready to import</li>
          <li><strong>${preview.budgetCount}</strong> budget targets</li>
          <li><strong>${preview.savingsGoalCount}</strong> savings goals</li>
          <li>Currency format: <strong>${preview.currency}</strong></li>
        </ul>
      </div>
      <p style="font-size:12px; color:var(--text-muted); line-height:1.5;">
        <strong>Merge Data:</strong> Adds new transactions while preserving your current records without creating duplicate IDs.<br>
        <strong>Replace All:</strong> Overwrites your existing dataset with the contents of this file.
      </p>
    `;
    dlg.showModal();
  },
  executeImport: (mode: 'merge' | 'replace') => {
    if (!pendingImport) return;
    const current = store.getState().data;

    if (mode === 'merge') {
      const merged = mergeData(current, pendingImport.data);
      store.getState().data = merged;
      store.showToast(`Merged ${pendingImport.transactionCount} transactions!`);
    } else {
      store.getState().data = pendingImport.data;
      store.showToast(`Replaced data with ${pendingImport.transactionCount} transactions.`);
    }

    pendingImport = null;
    closeDialog('dlg-import');
    store.changeMonth(0); // triggers persist and notification
  },

  loadSampleData: () => store.loadSampleData(),
  clearAllData: () => {
    if (confirm('Permanently delete all transactions, budgets, and goals? This cannot be undone.')) {
      store.clearAllData();
      store.showToast('All local data cleared.');
    }
  },

  executeToastUndo: () => {
    const toast = store.getState().ui.toast;
    if (toast && toast.undoAction) {
      toast.undoAction();
      store.dismissToast();
      store.showToast('Action undone');
    }
  },
  dismissToast: () => store.dismissToast(),

  promptInstall: async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      renderInstallButton();
    }
  },
  showIOSInstallGuide: () => {
    alert('To install Flo on iPhone / iPad:\n1. Tap the Share button in Safari toolbar.\n2. Scroll down and tap "Add to Home Screen".');
  },
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    (window as any).floApp.closeCalendar();
  }

  const activeTag = document.activeElement?.tagName.toLowerCase();
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
    return;
  }

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    (window as any).floApp.openAddTransactionModal();
  }
});

document.addEventListener('click', (e) => {
  const container = document.getElementById('month-picker-container');
  const dropdown = document.getElementById('calendar-dropdown');
  if (container && dropdown && !container.contains(e.target as Node)) {
    dropdown.style.display = 'none';
  }
});

window.addEventListener('online', () => store.changeMonth(0));
window.addEventListener('offline', () => store.changeMonth(0));

store.applyTheme();
store.subscribe((state) => renderApp(state));
renderApp(store.getState());
