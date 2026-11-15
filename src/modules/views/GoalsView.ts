/**
 * Savings Goals View
 * Tracks financial ambitions (Emergency Fund, Travel, Tech gadgets) with progress percentages and target dates.
 */

import { formatMoney } from '../money.ts';
import { escapeHtml } from '../security.ts';
import type { AppState } from '../store.ts';

export function renderGoalsView(state: AppState): string {
  const currency = state.data.settings.currency;
  const goals = state.data.savingsGoals;

  return `
    <div class="goals-view animate-fade-in" style="display:flex; flex-direction:column; gap:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-family:var(--font-display); font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-0.5px;">
            Savings Goals
          </h2>
          <p style="font-size:12px; color:var(--text-muted);">
            Visualize your progress toward big purchases and financial freedom
          </p>
        </div>
        <button class="btn btn-primary" onclick="window.floApp.openAddGoalModal()">
          + New Savings Goal
        </button>
      </div>

      ${goals.length > 0 ? `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
          ${goals.map((goal) => {
            const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
            const isCompleted = goal.currentAmount >= goal.targetAmount;

            return `
              <div class="card" style="border:1.5px solid ${isCompleted ? 'var(--income)' : 'var(--border-soft)'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:26px; width:46px; height:46px; border-radius:12px; background:var(--indigo-light); display:flex; align-items:center; justify-content:center;">
                      ${goal.emoji}
                    </span>
                    <div>
                      <div style="font-weight:700; font-size:16px; color:var(--text-primary); font-family:var(--font-display);">
                        ${escapeHtml(goal.name)}
                      </div>
                      <div style="font-size:12px; color:var(--text-muted);">
                        Target: ${goal.targetDate || 'No date set'}
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; gap:4px;">
                    <button class="btn btn-sm" onclick="window.floApp.openEditGoalModal('${goal.id}')" title="Edit Goal" aria-label="Edit goal ${escapeHtml(goal.name)}">
                      ✏️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.floApp.deleteGoal('${goal.id}')" title="Delete Goal" aria-label="Delete goal ${escapeHtml(goal.name)}">
                      🗑️
                    </button>
                  </div>
                </div>

                <!-- Progress numbers -->
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                  <div style="display:inline-flex; align-items:baseline; gap:4px; white-space:nowrap;">
                    <span style="font-size:22px; font-weight:700; color:var(--text-primary);" class="money-value">
                      ${formatMoney(goal.currentAmount, currency)}
                    </span>
                    <span style="font-size:13px; color:var(--text-muted); font-weight:600;" class="money-value">
                      / ${formatMoney(goal.targetAmount, currency)}
                    </span>
                  </div>
                  <div style="font-size:13px; font-weight:700; color:${isCompleted ? 'var(--income)' : 'var(--indigo)'};">
                    ${pct}%
                  </div>
                </div>

                <!-- Progress bar -->
                <div style="height:10px; background:var(--border-soft); border-radius:5px; overflow:hidden; margin-bottom:14px;">
                  <div style="width:${pct}%; height:100%; background:${isCompleted ? 'var(--income)' : 'var(--indigo)'}; border-radius:5px; transition:width 0.3s ease;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                  <span style="color:var(--text-muted);">
                    ${isCompleted ? '🎉 Goal Achieved!' : `${formatMoney(remaining, currency)} left to save`}
                  </span>
                  <button class="btn btn-sm btn-primary" onclick="window.floApp.quickContributeToGoal('${goal.id}')">
                    + Contribute
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card empty-state" style="padding:48px 20px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">🌱</div>
          <h3 style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:6px;">No savings goals yet</h3>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">
            Set a goal for vacation, an emergency fund, or a new laptop.
          </p>
          <button class="btn btn-primary" onclick="window.floApp.openAddGoalModal()">+ Create Savings Goal</button>
        </div>
      `}
    </div>
  `;
}
