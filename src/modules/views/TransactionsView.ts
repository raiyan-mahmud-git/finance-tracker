/**
 * Transactions Activity View
 *
 * Requirements & Bug Fixes:
 * - Bug #1 (XSS): All user-generated descriptions and custom categories escaped safely.
 * - Bug #9: Highlights selected day if user jumped to a specific date from the calendar.
 * - Edit and Delete actions with Undo toast restoration.
 * - Search query filter, Type filter chips, Custom Date Range picker, and Sorting options.
 * - Pagination controls for long lists.
 */

import { compareTransactionsDesc, isDateInYearMonth } from '../dates.ts';
import { formatMoney } from '../money.ts';
import { escapeHtml } from '../security.ts';
import type { AppState } from '../store.ts';
import type { Transaction } from '../types.ts';

export function renderTransactionsView(state: AppState): string {
  const currency = state.data.settings.currency;
  const categories = state.data.categories;
  const ym = state.ui.viewedYearMonth;
  const filter = state.ui.currentFilter;
  const query = state.ui.searchQuery.toLowerCase().trim();
  const sort = state.ui.sortOrder;
  const page = state.ui.page;
  const pageSize = state.ui.pageSize;
  const selectedDay = state.ui.selectedDay;

  // Filter pipeline
  let filtered: Transaction[] = [...state.data.transactions];

  // 1. Type filter
  if (filter === 'income') {
    filtered = filtered.filter(t => t.type === 'income');
  } else if (filter === 'expense') {
    filtered = filtered.filter(t => t.type === 'expense');
  } else if (filter === 'month') {
    filtered = filtered.filter(t => isDateInYearMonth(t.date, ym));
  } else if (filter === 'custom' && (state.ui.startDateFilter || state.ui.endDateFilter)) {
    if (state.ui.startDateFilter) {
      filtered = filtered.filter(t => t.date >= state.ui.startDateFilter);
    }
    if (state.ui.endDateFilter) {
      filtered = filtered.filter(t => t.date <= state.ui.endDateFilter);
    }
  }

  // 2. Day highlight filter (if selected in calendar)
  if (selectedDay !== null) {
    const dayStr = String(selectedDay).padStart(2, '0');
    const targetDatePrefix = `${ym.year}-${String(ym.month + 1).padStart(2, '0')}-${dayStr}`;
    filtered = filtered.filter(t => t.date === targetDatePrefix);
  }

  // 3. Search query
  if (query) {
    filtered = filtered.filter(t => {
      const cat = categories.find(c => c.id === t.category);
      const catName = cat ? cat.name.toLowerCase() : '';
      return (t.description || '').toLowerCase().includes(query) || catName.includes(query);
    });
  }

  // 4. Sorting
  if (sort === 'date-desc') {
    filtered.sort(compareTransactionsDesc);
  } else if (sort === 'date-asc') {
    filtered.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  } else if (sort === 'amount-desc') {
    filtered.sort((a, b) => b.amount - a.amount);
  } else if (sort === 'amount-asc') {
    filtered.sort((a, b) => a.amount - b.amount);
  }

  // 5. Pagination
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pagedTxns = filtered.slice(startIdx, startIdx + pageSize);

  return `
    <div class="transactions-view animate-fade-in" style="display:flex; flex-direction:column; gap:20px;">
      <!-- Search & Filters Toolbar -->
      <div class="card transaction-filters" style="padding:16px 20px;">
        <div class="transaction-toolbar" style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:14px;">
          <!-- Search input -->
          <div style="position:relative; flex:1; min-width:240px;">
            <span style="position:absolute; left:12px; top:11px; font-size:14px; color:var(--text-muted);">🔍</span>
            <input
              id="search-input"
              type="search"
              placeholder="Search description or category..."
              value="${escapeHtml(state.ui.searchQuery)}"
              class="input"
              style="padding-left:36px; padding-top:8px; padding-bottom:8px; margin-bottom:0;"
              oninput="window.floApp.handleSearchInput(this.value)"
              aria-label="Search transactions"
            >
          </div>

          <!-- Sort Dropdown -->
          <div style="display:flex; align-items:center; gap:8px;">
            <label for="sort-select" style="font-size:12px; font-weight:600; color:var(--text-muted); white-space:nowrap;">Sort by:</label>
            <select
              id="sort-select"
              class="btn"
              style="padding:7px 12px; font-size:12px;"
              onchange="window.floApp.handleSortChange(this.value)"
              aria-label="Sort transactions"
            >
              <option value="date-desc" ${sort === 'date-desc' ? 'selected' : ''}>Date: Newest First</option>
              <option value="date-asc" ${sort === 'date-asc' ? 'selected' : ''}>Date: Oldest First</option>
              <option value="amount-desc" ${sort === 'amount-desc' ? 'selected' : ''}>Amount: High to Low</option>
              <option value="amount-asc" ${sort === 'amount-asc' ? 'selected' : ''}>Amount: Low to High</option>
            </select>
          </div>
        </div>

        <!-- Filter Chips & Custom Date Range -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="filter-chip ${filter === 'all' && selectedDay === null ? 'active' : ''}" onclick="window.floApp.setFilter('all')">
            All (${state.data.transactions.length})
          </button>
          <button class="filter-chip ${filter === 'income' ? 'active' : ''}" onclick="window.floApp.setFilter('income')">
            💰 Income
          </button>
          <button class="filter-chip ${filter === 'expense' ? 'active' : ''}" onclick="window.floApp.setFilter('expense')">
            💸 Expenses
          </button>
          <button class="filter-chip ${filter === 'month' ? 'active' : ''}" onclick="window.floApp.setFilter('month')">
            🗓️ Viewed Month
          </button>
          <button class="filter-chip ${filter === 'custom' ? 'active' : ''}" onclick="window.floApp.toggleCustomDateFilter()">
            📅 Date Range
          </button>

          ${selectedDay !== null ? `
            <span style="font-size:12px; font-weight:600; background:var(--indigo-light); color:var(--indigo); padding:4px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:6px;">
              Filtered to Day ${selectedDay}
              <button onclick="window.floApp.clearDayFilter()" style="font-size:14px; line-height:1; cursor:pointer;" aria-label="Clear day filter">✕</button>
            </span>
          ` : ''}
        </div>

        <!-- Custom Date Range Subpanel -->
        ${filter === 'custom' ? `
          <div style="display:flex; gap:12px; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid var(--border-soft); flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; color:var(--text-muted);">From:</span>
              <input type="date" value="${state.ui.startDateFilter}" onchange="window.floApp.setDateFilter('start', this.value)" class="input" style="padding:6px 10px; font-size:12px; margin-bottom:0; width:auto;">
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; color:var(--text-muted);">To:</span>
              <input type="date" value="${state.ui.endDateFilter}" onchange="window.floApp.setDateFilter('end', this.value)" class="input" style="padding:6px 10px; font-size:12px; margin-bottom:0; width:auto;">
            </div>
            <button class="btn btn-sm" onclick="window.floApp.clearDateRangeFilter()">Clear Range</button>
          </div>
        ` : ''}
      </div>

      <!-- Transactions List -->
      <div class="card" style="padding:0; overflow:hidden;" role="region" aria-label="Transactions list">
        ${pagedTxns.length > 0 ? `
          <div style="display:flex; flex-direction:column;">
            ${pagedTxns.map((t) => {
              const cat = categories.find(c => c.id === t.category) || { name: t.category, emoji: '📦', color: '#8395A7' };
              const isIncome = t.type === 'income';

              return `
                <div class="txn-row" style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border-soft);" tabindex="0">
                  <div class="txn-row-main" style="display:flex; align-items:center; gap:14px; min-width:0; flex:1;">
                    <span style="width:40px; height:40px; border-radius:12px; background:${cat.color}20; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
                      ${cat.emoji}
                    </span>
                    <div style="min-width:0; flex:1;">
                      <!-- Bug #1 fix: escapeHtml prevents XSS injection -->
                      <div style="font-weight:600; font-size:14px; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                        ${escapeHtml(t.description || (isIncome ? 'Income' : 'Expense'))}
                      </div>
                      <div class="txn-row-meta" style="font-size:12px; color:var(--text-muted); margin-top:2px; display:flex; align-items:center; gap:8px;">
                        <span>${escapeHtml(cat.name)}</span>
                        <span>•</span>
                        <span>${t.date}</span>
                        ${t.recurringRuleId ? `<span style="font-size:10px; background:var(--indigo-light); color:var(--indigo); padding:1px 6px; border-radius:10px; font-weight:600;">Recurring</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- Amount & Edit/Delete Action Buttons -->
                  <div class="txn-row-trailing" style="display:flex; align-items:center; gap:16px; margin-left:12px;">
                    <div style="font-weight:700; font-size:16px; color:${isIncome ? 'var(--income)' : 'var(--expense)'}; white-space:nowrap; display:inline-flex; align-items:baseline;" class="money-value">
                      ${isIncome ? '+' : '-'}${formatMoney(t.amount, currency)}
                    </div>

                    <div class="txn-row-actions" style="display:flex; gap:4px;">
                      <button class="btn btn-sm" onclick="window.floApp.openEditTransactionModal('${t.id}')" aria-label="Edit transaction ${escapeHtml(t.description)}" title="Edit">
                        ✏️
                      </button>
                      <button class="btn btn-sm btn-danger" onclick="window.floApp.deleteTransaction('${t.id}')" aria-label="Delete transaction ${escapeHtml(t.description)}" title="Delete">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="empty-state" style="padding:48px 20px; text-align:center;">
            <div style="font-size:42px; margin-bottom:12px;">🔍</div>
            <h3 style="font-weight:700; font-size:16px; color:var(--text-primary); margin-bottom:6px;">No transactions found</h3>
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">
              ${query ? `No items matched "${escapeHtml(query)}". Try clearing filters.` : 'Your activity list is currently empty.'}
            </p>
            <div style="display:flex; gap:10px; justify-content:center;">
              <button class="btn btn-primary" onclick="window.floApp.openAddTransactionModal()">+ Add Transaction</button>
              ${query || filter !== 'all' ? `<button class="btn" onclick="window.floApp.resetFilters()">Clear Filters</button>` : ''}
            </div>
          </div>
        `}

        <!-- Pagination Controls -->
        ${totalPages > 1 ? `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 20px; background:var(--bg-elevated); border-top:1px solid var(--border-soft); font-size:13px;">
            <div style="color:var(--text-muted);">
              Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, totalCount)} of ${totalCount}
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="window.floApp.setPage(${currentPage - 1})">
                ◀ Previous
              </button>
              <span style="display:flex; align-items:center; padding:0 8px; font-weight:600; color:var(--text-primary);">
                Page ${currentPage} of ${totalPages}
              </span>
              <button class="btn btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="window.floApp.setPage(${currentPage + 1})">
                Next ▶
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
