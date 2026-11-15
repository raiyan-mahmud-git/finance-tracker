/**
 * Mobile Bottom Tab Bar Component
 * Replaces hamburger navigation on small screens with an accessible, thumb-friendly tab bar.
 */

import { AppState } from '../store.ts';

export function renderMobileBottomBar(state: AppState): string {
  const activeView = state.ui.activeView;

  return `
    <nav class="mobile-tab-bar" aria-label="Mobile navigation">
      <button type="button" class="mobile-tab-btn ${activeView === 'dashboard' ? 'active' : ''}" onclick="window.floApp.switchView('dashboard')" aria-label="Dashboard">
        <span class="tab-icon">📊</span>
        <span class="tab-label">Home</span>
      </button>

      <button type="button" class="mobile-tab-btn ${activeView === 'transactions' ? 'active' : ''}" onclick="window.floApp.switchView('transactions')" aria-label="Transactions">
        <span class="tab-icon">📋</span>
        <span class="tab-label">Activity</span>
      </button>

      <!-- Center Quick Add Button -->
      <button type="button" class="mobile-tab-fab" onclick="window.floApp.openAddTransactionModal()" aria-label="Add transaction" title="Add transaction">
        +
      </button>

      <button type="button" class="mobile-tab-btn ${activeView === 'budgets' ? 'active' : ''}" onclick="window.floApp.switchView('budgets')" aria-label="Budgets">
        <span class="tab-icon">🎯</span>
        <span class="tab-label">Budgets</span>
      </button>

      <button type="button" class="mobile-tab-btn ${activeView === 'goals' ? 'active' : ''}" onclick="window.floApp.switchView('goals')" aria-label="Savings Goals">
        <span class="tab-icon">🌱</span>
        <span class="tab-label">Goals</span>
      </button>

      <button type="button" class="mobile-tab-btn ${activeView === 'settings' ? 'active' : ''}" onclick="window.floApp.switchView('settings')" aria-label="Settings">
        <span class="tab-icon">⚙️</span>
        <span class="tab-label">Settings</span>
      </button>
    </nav>
  `;
}
