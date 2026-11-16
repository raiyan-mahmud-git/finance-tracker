import { getTodayLocalDateString } from '../dates.ts';
import { fromMinorUnits, toMinorUnits } from '../money.ts';
import { store } from '../store.ts';

export function closeDialog(dialogId: string) {
  const dlg = document.getElementById(dialogId) as HTMLDialogElement | null;
  if (dlg && dlg.open) {
    dlg.close();
  }
}

export function initModals() {
  const container = document.getElementById('modals-container');
  if (!container) return;

  container.innerHTML = `

    <dialog id="dlg-transaction" class="native-modal" aria-labelledby="dlg-txn-title">
      <div class="modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h2 id="dlg-txn-title" style="font-size:20px; font-weight:800; color:var(--text-primary); letter-spacing:-0.4px;">
              New Transaction
            </h2>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Record an income or expense to keep your finances in flow.
            </p>
          </div>
          <button type="button" class="btn btn-sm" onclick="window.floApp.closeModal('dlg-transaction')" aria-label="Close dialog" style="font-size:14px; padding:6px 10px;">
            ✕
          </button>
        </div>

        <form id="form-transaction" onsubmit="window.floApp.handleTxnSubmit(event)">
          <input type="hidden" id="txn-edit-id" value="">
          <input type="hidden" id="txn-type" value="expense">

          <div class="type-segmented-control" role="tablist">
            <button type="button" id="btn-type-expense" class="type-segmented-btn active-expense" onclick="window.floApp.setTxnModalType('expense')" role="tab" aria-selected="true">
              <span>💸</span>
              <span>Expense</span>
            </button>
            <button type="button" id="btn-type-income" class="type-segmented-btn" onclick="window.floApp.setTxnModalType('income')" role="tab" aria-selected="false">
              <span>💰</span>
              <span>Income</span>
            </button>
          </div>

          <div style="margin-bottom:18px;">
            <label for="txn-amount" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
              Amount
            </label>
            <div style="position:relative; display:flex; align-items:center;">
              <span id="txn-currency-prefix" style="position:absolute; left:14px; font-size:14px; font-weight:700; color:var(--text-secondary); background:var(--bg-surface); padding:2px 8px; border-radius:6px; border:1px solid var(--border-medium); pointer-events:none;">
                USD
              </span>
              <input
                id="txn-amount"
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="0.00"
                style="padding-left:72px; font-size:22px; font-weight:700; height:52px;"
                class="input number-display"
                aria-label="Transaction Amount"
              >
            </div>
          </div>

          <div style="margin-bottom:18px;">
            <label for="txn-desc" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
              Description
            </label>
            <input
              id="txn-desc"
              type="text"
              placeholder="e.g. Grocery run, Dinner with friends, Salary"
              required
              class="input"
              style="margin-bottom:8px;"
              oninput="window.floApp.onTxnDescInput(this.value)"
            >

            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;" id="quick-tag-suggestions">
              <button type="button" class="quick-cat-chip" onclick="window.floApp.fillQuickTxn('Groceries', 'groceries', 'expense')">🛒 Groceries</button>
              <button type="button" class="quick-cat-chip" onclick="window.floApp.fillQuickTxn('Dining Out', 'food', 'expense')">🍔 Dining</button>
              <button type="button" class="quick-cat-chip" onclick="window.floApp.fillQuickTxn('Coffee', 'food', 'expense')">☕ Coffee</button>
              <button type="button" class="quick-cat-chip" onclick="window.floApp.fillQuickTxn('Monthly Rent', 'housing', 'expense')">🏠 Rent</button>
              <button type="button" class="quick-cat-chip" onclick="window.floApp.fillQuickTxn('Transit Pass', 'transport', 'expense')">🚗 Transit</button>
              <button type="button" class="quick-cat-chip" onclick="window.floApp.fillQuickTxn('Monthly Salary', 'salary', 'income')">💼 Salary</button>
            </div>
          </div>

          <div style="margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label for="txn-category" style="font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">
                Category
              </label>
              <button type="button" style="font-size:12px; color:var(--indigo); font-weight:600;" onclick="window.floApp.openCategoryModal()">
                + New Category
              </button>
            </div>
            <select id="txn-category" class="input" style="height:44px; font-size:14px; font-weight:500;"></select>
          </div>

          <div style="margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label for="txn-date" style="font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">
                Date
              </label>
              <button type="button" style="font-size:12px; color:var(--text-muted); font-weight:600;" onclick="document.getElementById('txn-date').value = window.floApp.getTodayLocalDateString()">
                Set to Today
              </button>
            </div>
            <input id="txn-date" type="date" required class="input" style="height:44px;">
          </div>

          <div style="display:flex; gap:12px; align-items:center;">
            <button type="button" class="btn" style="flex:1; height:46px; font-weight:600;" onclick="window.floApp.closeModal('dlg-transaction')">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" style="flex:2; height:46px; font-size:14px; font-weight:700;" id="txn-submit-btn">
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog id="dlg-budget" class="native-modal" aria-labelledby="dlg-budget-title">
      <div class="modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h2 id="dlg-budget-title" style="font-size:20px; font-weight:800; color:var(--text-primary); letter-spacing:-0.4px;">
              Set Monthly Budget
            </h2>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Define a monthly spending ceiling for a specific category.
            </p>
          </div>
          <button type="button" class="btn btn-sm" onclick="window.floApp.closeModal('dlg-budget')" aria-label="Close dialog">✕</button>
        </div>

        <form id="form-budget" onsubmit="window.floApp.handleBudgetSubmit(event)">
          <div style="margin-bottom:16px;">
            <label for="budget-category" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
              Category
            </label>
            <select id="budget-category" class="input" style="height:44px;"></select>
          </div>

          <div style="margin-bottom:18px;">
            <label for="budget-limit" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
              Monthly Limit
            </label>
            <div style="position:relative; display:flex; align-items:center;">
              <span id="budget-currency-prefix" style="position:absolute; left:14px; font-size:14px; font-weight:700; color:var(--text-secondary); background:var(--bg-surface); padding:2px 8px; border-radius:6px; border:1px solid var(--border-medium); pointer-events:none;">
                USD
              </span>
              <input id="budget-limit" type="number" step="any" min="1" required placeholder="300" style="padding-left:72px; font-size:20px; font-weight:700; height:50px;" class="input number-display">
            </div>
          </div>

          <label style="display:flex; align-items:flex-start; gap:12px; margin-bottom:24px; padding:12px; background:var(--bg-elevated); border-radius:12px; border:1px solid var(--border-soft); cursor:pointer;">
            <input type="checkbox" id="budget-rollover" style="width:18px; height:18px; accent-color:var(--indigo); margin-top:2px;">
            <div>
              <span style="font-weight:700; font-size:13px; color:var(--text-primary); display:block;">Enable Rollover</span>
              <p style="font-size:12px; color:var(--text-muted); line-height:1.4; margin-top:2px;">
                Unspent surplus from prior months is automatically added to this month's spending allowance.
              </p>
            </div>
          </label>

          <div style="display:flex; gap:12px;">
            <button type="button" class="btn" style="flex:1; height:44px;" onclick="window.floApp.closeModal('dlg-budget')">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex:2; height:44px;">Save Budget</button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog id="dlg-category" class="native-modal" aria-labelledby="dlg-cat-title">
      <div class="modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 id="dlg-cat-title" style="font-size:20px; font-weight:800; color:var(--text-primary);">Manage Categories</h2>
          <button type="button" class="btn btn-sm" onclick="window.floApp.closeModal('dlg-category')" aria-label="Close dialog">✕</button>
        </div>

        <form onsubmit="window.floApp.handleCreateCategory(event)" style="margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border-soft);">
          <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--text-primary);">Add Custom Category</div>
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            <input id="cat-emoji" type="text" value="🏷️" maxlength="2" style="width:50px; text-align:center; font-size:18px;" class="input" title="Emoji icon">
            <input id="cat-name" type="text" placeholder="Category name" required style="flex:1;" class="input">
            <input id="cat-color" type="color" value="#4338CA" style="width:48px; height:44px; padding:2px; border-radius:10px; cursor:pointer;" title="Accent color">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; height:40px;">+ Create Category</button>
        </form>

        <div style="font-size:13px; font-weight:700; margin-bottom:10px; color:var(--text-primary);">Active Categories</div>
        <div id="category-manager-list" style="max-height:240px; overflow-y:auto;"></div>
      </div>
    </dialog>

    <dialog id="dlg-goal" class="native-modal" aria-labelledby="dlg-goal-title">
      <div class="modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 id="dlg-goal-title" style="font-size:20px; font-weight:800; color:var(--text-primary);">Savings Goal</h2>
          <button type="button" class="btn btn-sm" onclick="window.floApp.closeModal('dlg-goal')" aria-label="Close dialog">✕</button>
        </div>

        <form id="form-goal" onsubmit="window.floApp.handleGoalSubmit(event)">
          <input type="hidden" id="goal-edit-id" value="">
          <div style="display:flex; gap:8px; margin-bottom:16px;">
            <input id="goal-emoji" type="text" value="🎯" maxlength="2" style="width:50px; text-align:center; font-size:18px;" class="input">
            <input id="goal-name" type="text" placeholder="Goal name (e.g. Travel, Emergency Fund)" required style="flex:1;" class="input">
          </div>

          <div style="margin-bottom:16px;">
            <label for="goal-target" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Target Amount</label>
            <div style="position:relative; display:flex; align-items:center;">
              <span id="goal-currency-prefix" style="position:absolute; left:14px; font-size:14px; font-weight:700; color:var(--text-secondary); background:var(--bg-surface); padding:2px 8px; border-radius:6px; border:1px solid var(--border-medium);">USD</span>
              <input id="goal-target" type="number" step="any" min="1" required placeholder="1000.00" style="padding-left:72px;" class="input number-display">
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label for="goal-current" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Current Amount Saved</label>
            <div style="position:relative; display:flex; align-items:center;">
              <span id="goal-curr-prefix" style="position:absolute; left:14px; font-size:14px; font-weight:700; color:var(--text-secondary); background:var(--bg-surface); padding:2px 8px; border-radius:6px; border:1px solid var(--border-medium);">USD</span>
              <input id="goal-current" type="number" step="any" min="0" value="0" style="padding-left:72px;" class="input number-display">
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <label for="goal-date" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Target Date</label>
            <input id="goal-date" type="date" required class="input">
          </div>

          <div style="display:flex; gap:12px;">
            <button type="button" class="btn" style="flex:1; height:44px;" onclick="window.floApp.closeModal('dlg-goal')">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex:2; height:44px;">Save Goal</button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog id="dlg-recurring" class="native-modal" aria-labelledby="dlg-rec-title">
      <div class="modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 id="dlg-rec-title" style="font-size:20px; font-weight:800; color:var(--text-primary);">Recurring Schedule</h2>
          <button type="button" class="btn btn-sm" onclick="window.floApp.closeModal('dlg-recurring')" aria-label="Close dialog">✕</button>
        </div>

        <form onsubmit="window.floApp.handleRecurringSubmit(event)">
          <div style="display:flex; gap:8px; margin-bottom:16px;">
            <select id="rec-type" class="input" style="flex:1;">
              <option value="expense">💸 Expense</option>
              <option value="income">💰 Income</option>
            </select>
            <select id="rec-freq" class="input" style="flex:1;">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div style="margin-bottom:16px;">
            <label for="rec-amount" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Amount</label>
            <div style="position:relative; display:flex; align-items:center;">
              <span id="rec-currency-prefix" style="position:absolute; left:14px; font-size:14px; font-weight:700; color:var(--text-secondary); background:var(--bg-surface); padding:2px 8px; border-radius:6px; border:1px solid var(--border-medium);">USD</span>
              <input id="rec-amount" type="number" step="any" min="0.01" required placeholder="0.00" style="padding-left:72px;" class="input number-display">
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label for="rec-desc" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Description</label>
            <input id="rec-desc" type="text" placeholder="e.g. Netflix, Apartment Rent, Tech Salary" required class="input">
          </div>

          <div style="margin-bottom:16px;">
            <label for="rec-category" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Category</label>
            <select id="rec-category" class="input"></select>
          </div>

          <div style="margin-bottom:24px;">
            <label for="rec-date" style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Start Date</label>
            <input id="rec-date" type="date" required class="input">
          </div>

          <div style="display:flex; gap:12px;">
            <button type="button" class="btn" style="flex:1; height:44px;" onclick="window.floApp.closeModal('dlg-recurring')">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex:2; height:44px;">Save Schedule</button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog id="dlg-import" class="native-modal" aria-labelledby="dlg-import-title">
      <div class="modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 id="dlg-import-title" style="font-size:20px; font-weight:800; color:var(--text-primary);">Import Data Preview</h2>
          <button type="button" class="btn btn-sm" onclick="window.floApp.closeModal('dlg-import')" aria-label="Close dialog">✕</button>
        </div>

        <div id="import-preview-body" style="margin-bottom:24px;"></div>

        <div style="display:flex; gap:12px;">
          <button type="button" class="btn" style="flex:1;" onclick="window.floApp.closeModal('dlg-import')">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-import-merge" onclick="window.floApp.executeImport('merge')">Merge Data</button>
          <button type="button" class="btn btn-danger" id="btn-import-replace" onclick="window.floApp.executeImport('replace')">Replace All</button>
        </div>
      </div>
    </dialog>
  `;

  container.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        dialog.close();
      }
    });
  });
}
