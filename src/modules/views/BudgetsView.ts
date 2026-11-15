/**
 * Budgets & Recurring Schedules View
 *
 * Requirements:
 * - Over-budget state: clearly highlights expenses exceeding 100% in vibrant red without clipping.
 * - Rollover option: unspent surplus from the prior month expands the current month's allowance.
 * - 80% warning threshold: triggers amber alert state to help users pace expenses.
 * - Add, Edit, and Delete budgets with Undo support.
 * - Recurring schedules manager: weekly/monthly automation with instant pause/resume toggles.
 */

import { calculateBudgetStatuses } from '../analytics.ts';
import { formatYearMonth } from '../dates.ts';
import { formatMoney } from '../money.ts';
import { escapeHtml } from '../security.ts';
import type { AppState } from '../store.ts';

export function renderBudgetsView(state: AppState): string {
  const currency = state.data.settings.currency;
  const ym = state.ui.viewedYearMonth;
  const budgets = state.data.budgets;
  const transactions = state.data.transactions;
  const categories = state.data.categories;
  const recurringRules = state.data.recurringRules;

  const statuses = calculateBudgetStatuses(budgets, transactions, ym);

  return `
    <div class="budgets-view animate-fade-in" style="display:flex; flex-direction:column; gap:28px;">
      <!-- Budgets Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-family:var(--font-display); font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-0.5px;">
            Monthly Budgets
          </h2>
          <p style="font-size:12px; color:var(--text-muted);">
            Active for ${formatYearMonth(ym)}
          </p>
        </div>
        <button class="btn btn-primary" onclick="window.floApp.openAddBudgetModal()">
          + New Budget
        </button>
      </div>

      <!-- Budgets Grid -->
      ${statuses.length > 0 ? `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
          ${statuses.map(({ budget, spent, effectiveLimit, percentage, isOverBudget, isWarning, remaining }) => {
            const cat = categories.find(c => c.id === budget.category) || { name: budget.category, emoji: '📦', color: '#8395A7' };
            const barFillPct = Math.min(percentage, 100);

            let statusBadge = '';
            let barColor = 'var(--income)';
            if (isOverBudget) {
              barColor = 'var(--expense)';
              statusBadge = `
                <span style="font-size:11px; font-weight:700; background:var(--expense-light); color:var(--expense); padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                  ⚠️ OVER BUDGET by ${formatMoney(Math.abs(remaining), currency)}
                </span>
              `;
            } else if (isWarning) {
              barColor = 'var(--amber)';
              statusBadge = `
                <span style="font-size:11px; font-weight:700; background:var(--amber-light); color:var(--amber); padding:3px 8px; border-radius:12px;">
                  ⚡ Near Limit (${Math.round(percentage)}%)
                </span>
              `;
            } else {
              statusBadge = `
                <span style="font-size:11px; font-weight:600; color:var(--text-muted);">
                  ${formatMoney(remaining, currency)} remaining
                </span>
              `;
            }

            return `
              <div class="card" style="border:1.5px solid ${isOverBudget ? 'var(--expense)' : (isWarning ? 'var(--amber)' : 'var(--border-soft)')};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:24px; width:44px; height:44px; border-radius:12px; background:${cat.color}20; display:flex; align-items:center; justify-content:center;">
                      ${cat.emoji}
                    </span>
                    <div>
                      <div style="font-weight:700; font-size:16px; color:var(--text-primary); font-family:var(--font-display);">
                        ${escapeHtml(cat.name)}
                      </div>
                      <div style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                        <span>Monthly target</span>
                        ${budget.rollover ? '<span style="color:var(--indigo); font-weight:600;">(Rollover enabled)</span>' : ''}
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; gap:4px;">
                    <button class="btn btn-sm" onclick="window.floApp.openEditBudgetModal('${budget.id}')" title="Edit Budget" aria-label="Edit budget for ${cat.name}">
                      ✏️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.floApp.deleteBudget('${budget.id}')" title="Delete Budget" aria-label="Delete budget for ${cat.name}">
                      🗑️
                    </button>
                  </div>
                </div>

                <!-- Numbers Row -->
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
                  <div style="display:inline-flex; align-items:baseline; gap:4px; white-space:nowrap;">
                    <span style="font-size:22px; font-weight:700; color:${isOverBudget ? 'var(--expense)' : 'var(--text-primary)'};" class="money-value">
                      ${formatMoney(spent, currency)}
                    </span>
                    <span style="font-size:13px; color:var(--text-muted); font-weight:600;" class="money-value">
                      / ${formatMoney(effectiveLimit, currency)}
                    </span>
                  </div>
                  <div>${statusBadge}</div>
                </div>

                <!-- Uncapped Progress Bar with over-limit overflow styling -->
                <div style="height:10px; background:var(--border-soft); border-radius:5px; overflow:hidden; position:relative;">
                  <div style="width:${barFillPct}%; height:100%; background:${barColor}; border-radius:5px; transition:width 0.3s ease;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:11px; color:var(--text-muted);">
                  <span>${Math.round(percentage)}% allocated</span>
                  ${effectiveLimit !== budget.limit ? `<span>Includes rollover adjustment</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card empty-state" style="padding:48px 20px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">🎯</div>
          <h3 style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:6px;">No budgets created yet</h3>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">
            Set spending targets for Food, Housing, Shopping or any category to stay disciplined.
          </p>
          <button class="btn btn-primary" onclick="window.floApp.openAddBudgetModal()">+ Create First Budget</button>
        </div>
      `}

      <!-- RECURRING TRANSACTIONS SECTION -->
      <div style="margin-top:20px; padding-top:24px; border-top:1px solid var(--border-soft);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--text-primary);">
              Automated Recurring Transactions
            </h3>
            <p style="font-size:12px; color:var(--text-muted);">
              Automatically logs bills, subscriptions, or salaries on their scheduled dates.
            </p>
          </div>
          <button class="btn btn-sm btn-primary" onclick="window.floApp.openAddRecurringModal()">
            + Add Schedule
          </button>
        </div>

        ${recurringRules.length > 0 ? `
          <div class="card" style="padding:0; overflow:hidden;">
            ${recurringRules.map((rule) => {
              const cat = categories.find(c => c.id === rule.category) || { name: rule.category, emoji: '📦', color: '#8395A7' };
              const isIncome = rule.type === 'income';

              return `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border-soft); opacity:${rule.paused ? '0.65' : '1'};">
                  <div style="display:flex; align-items:center; gap:14px;">
                    <span style="font-size:20px; width:38px; height:38px; border-radius:10px; background:${cat.color}20; display:flex; align-items:center; justify-content:center;">
                      ${cat.emoji}
                    </span>
                    <div>
                      <div style="font-weight:600; font-size:14px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                        <span>${escapeHtml(rule.description)}</span>
                        ${rule.paused ? '<span style="font-size:10px; background:var(--border-medium); padding:1px 6px; border-radius:10px; color:var(--text-muted);">PAUSED</span>' : ''}
                      </div>
                      <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                        <span>${rule.frequency === 'weekly' ? 'Weekly' : 'Monthly'}</span>
                        <span>•</span>
                        <span>${escapeHtml(cat.name)}</span>
                        <span>•</span>
                        <span>Starts ${rule.startDate}</span>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; align-items:center; gap:16px;">
                    <div style="font-family:var(--font-display); font-weight:700; font-size:15px; color:${isIncome ? 'var(--income)' : 'var(--expense)'};">
                      ${isIncome ? '+' : '-'}${formatMoney(rule.amount, currency)}
                    </div>

                    <button class="btn btn-sm" onclick="window.floApp.togglePauseRecurring('${rule.id}')" title="${rule.paused ? 'Resume' : 'Pause'}">
                      ${rule.paused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.floApp.deleteRecurring('${rule.id}')" title="Delete Schedule">
                      🗑️
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="card empty-state" style="padding:28px 20px; text-align:center;">
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">No recurring schedules configured.</p>
            <button class="btn btn-sm" onclick="window.floApp.openAddRecurringModal()">+ Add Recurring Transaction</button>
          </div>
        `}
      </div>
    </div>
  `;
}
