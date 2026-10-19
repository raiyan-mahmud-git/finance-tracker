// js/views.js
// Renders all views with XSS prevention, clean semantic HTML, and accessibility features.

import { store } from './store.js';
import { formatMoney, formatMoneyCompact, toMinorUnits } from './money.js';
import {
  formatMonthYear,
  getSixMonthWindow,
  formatDisplayDate,
  toMonthKey,
  getCalendarGrid,
  addMonths,
} from './dates.js';
import { renderBarChartSvg, renderDonutChartSvg, renderBalanceTimelineSvg } from './charts.js';

/**
 * Bug 1 Fix: Pure escaping helper to prevent any XSS vulnerability
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Find category helper
 */
function getCategory(categories, catId) {
  return categories.find(c => c.id === catId) || { id: catId, name: catId, emoji: '📦', color: '#8D6E63' };
}

// -------------------------------------------------------------
// DASHBOARD VIEW
// -------------------------------------------------------------
export function renderDashboardView(containerEl, state) {
  const { transactions, categories, budgets, settings, ui } = state;
  const viewedYm = ui.viewedYearMonth;
  const viewedKey = toMonthKey(viewedYm);
  const currencyKey = settings.currency;

  // Bug 3 Fix: True Cumulative balance vs Monthly Income & Expense
  let cumulativeBalance = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  let incomeTxnCount = 0;
  let expenseTxnCount = 0;

  transactions.forEach(t => {
    if (t.type === 'income') {
      cumulativeBalance += t.amount;
    } else {
      cumulativeBalance -= t.amount;
    }

    if (t.date.startsWith(viewedKey)) {
      if (t.type === 'income') {
        monthIncome += t.amount;
        incomeTxnCount++;
      } else {
        monthExpense += t.amount;
        expenseTxnCount++;
      }
    }
  });

  const monthNet = monthIncome - monthExpense;

  // Calculate Insights (Phase 2):
  // 1. Average daily spend
  const today = new Date();
  const isViewingCurrentMonth = (today.getFullYear() === viewedYm.year && (today.getMonth() + 1) === viewedYm.month);
  const daysInMonth = new Date(viewedYm.year, viewedYm.month, 0).getDate();
  const daysPassed = isViewingCurrentMonth ? Math.max(1, today.getDate()) : daysInMonth;
  const avgDailySpendMinor = Math.round(monthExpense / daysPassed);
  const projectedMonthEndMinor = avgDailySpendMinor * daysInMonth;

  // 2. Biggest category change vs last month
  const prevYm = addMonths(viewedYm, -1);
  const prevKey = toMonthKey(prevYm);
  const catSpendingCurrent = {};
  const catSpendingPrev = {};

  transactions.forEach(t => {
    if (t.type === 'expense') {
      if (t.date.startsWith(viewedKey)) {
        catSpendingCurrent[t.category] = (catSpendingCurrent[t.category] || 0) + t.amount;
      } else if (t.date.startsWith(prevKey)) {
        catSpendingPrev[t.category] = (catSpendingPrev[t.category] || 0) + t.amount;
      }
    }
  });

  let biggestChangeCatId = null;
  let biggestChangeDiff = 0;
  Object.keys({ ...catSpendingCurrent, ...catSpendingPrev }).forEach(catId => {
    const cur = catSpendingCurrent[catId] || 0;
    const prv = catSpendingPrev[catId] || 0;
    const diff = cur - prv;
    if (Math.abs(diff) > Math.abs(biggestChangeDiff)) {
      biggestChangeDiff = diff;
      biggestChangeCatId = catId;
    }
  });

  const biggestCatObj = biggestChangeCatId ? getCategory(categories, biggestChangeCatId) : null;

  // Total budget for month
  const totalBudgetMinor = budgets.reduce((sum, b) => sum + b.limit, 0);
  const isOverPace = totalBudgetMinor > 0 && projectedMonthEndMinor > totalBudgetMinor;

  // Prepare 6-month bar chart data
  const sixMonths = getSixMonthWindow(viewedYm);
  const barDataList = sixMonths.map(m => {
    let inc = 0;
    let exp = 0;
    transactions.forEach(t => {
      if (t.date.startsWith(m.key)) {
        if (t.type === 'income') inc += t.amount;
        else exp += t.amount;
      }
    });
    return {
      label: m.label,
      year: m.year,
      month: m.month,
      income: inc,
      expense: exp,
    };
  });

  const avg6MoIncome = barDataList.reduce((s, d) => s + d.income, 0) / barDataList.length;
  const avg6MoExpense = barDataList.reduce((s, d) => s + d.expense, 0) / barDataList.length;

  // Donut chart spending list
  const catSpendEntries = Object.entries(catSpendingCurrent)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, amt]) => ({
      category: getCategory(categories, catId),
      amount: amt,
    }));

  // Balance Timeline Data (cumulative balance over time)
  const sortedTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let runningBal = 0;
  const timelineData = sortedTxns.map(t => {
    runningBal += (t.type === 'income' ? t.amount : -t.amount);
    return { date: t.date, balance: runningBal };
  });

  containerEl.innerHTML = `
    <!-- Cumulative balance card with net month pill -->
    <div class="card balance-large" tabindex="0" aria-label="Total Cumulative Balance: ${formatMoney(cumulativeBalance, currencyKey)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
        <div>
          <div class="balance-label">Total Current Balance</div>
          <div class="balance-number" id="netBalance">${formatMoney(cumulativeBalance, currencyKey)}</div>
        </div>
        <div style="text-align:right;">
          <div class="balance-label">This Month's Net</div>
          <div class="net-pill ${monthNet >= 0 ? 'income' : 'expense'}" style="font-weight:600; font-size:16px;">
            ${monthNet >= 0 ? '+' : ''}${formatMoney(monthNet, currencyKey)}
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly income and expense cards -->
    <div class="monthly-cards">
      <div class="card monthly-card income" tabindex="0">
        <div class="label">Monthly income</div>
        <div class="value">${formatMoney(monthIncome, currencyKey)}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">↑ ${incomeTxnCount} transactions</div>
      </div>
      <div class="card monthly-card expense" tabindex="0">
        <div class="label">Monthly expense</div>
        <div class="value">${formatMoney(monthExpense, currencyKey)}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">↓ ${expenseTxnCount} transactions</div>
      </div>
    </div>

    <!-- Financial Insights Panel -->
    <div class="card" style="margin-bottom:28px;">
      <div class="section-title" style="display:flex; align-items:center; gap:8px;">
        <span>💡</span> Monthly Smart Insights
      </div>
      <div class="insights-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
        <div class="insight-item">
          <div class="label">Avg Daily Spend</div>
          <div class="value">${formatMoney(avgDailySpendMinor, currencyKey)}/day</div>
        </div>
        <div class="insight-item">
          <div class="label">Projected Month-End</div>
          <div class="value">${formatMoney(projectedMonthEndMinor, currencyKey)}</div>
        </div>
        <div class="insight-item">
          <div class="label">Budget Pace</div>
          <div class="value" style="color:${isOverPace ? 'var(--expense)' : 'var(--income)'}">
            ${isOverPace ? '⚠️ Over Pace' : '✅ On Track'}
          </div>
        </div>
        ${biggestCatObj ? `
          <div class="insight-item">
            <div class="label">Biggest Shift vs Last Month</div>
            <div class="value" style="font-size:14px;">
              ${biggestCatObj.emoji} ${escapeHtml(biggestCatObj.name)}: 
              <span style="color:${biggestChangeDiff > 0 ? 'var(--expense)' : 'var(--income)'}">
                ${biggestChangeDiff > 0 ? '+' : ''}${formatMoney(biggestChangeDiff, currencyKey)}
              </span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- 6-Month Income vs Expense Bar Chart -->
    <div class="card" style="margin-bottom:28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-weight:600; color:var(--text-primary);">6-Month Overview</span>
        <div style="display:flex; gap:16px; font-size:12px;">
          <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:10px; height:10px; background:var(--income); border-radius:3px;"></span> Income
          </span>
          <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:10px; height:10px; background:var(--expense); border-radius:3px;"></span> Expense
          </span>
        </div>
      </div>
      <div id="barChartContainer"></div>
      <div class="chart-averages" style="margin-top:16px;">
        <div class="avg-item"><div class="label">Avg monthly income</div><div class="value">${formatMoneyCompact(avg6MoIncome, currencyKey)}</div></div>
        <div class="avg-item"><div class="label">Avg monthly expense</div><div class="value">${formatMoneyCompact(avg6MoExpense, currencyKey)}</div></div>
      </div>
    </div>

    <!-- Charts row: Donut & Balance Timeline -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px; margin-bottom:28px;">
      <div class="card">
        <div class="section-title">Spending by Category</div>
        <div id="donutChartContainer"></div>
      </div>
      <div class="card">
        <div class="section-title">Balance Timeline</div>
        <div id="timelineChartContainer"></div>
      </div>
    </div>

    <!-- Top categories list -->
    <div class="card">
      <div class="section-title">Top Expense Categories</div>
      <div id="categoryRows">
        ${catSpendEntries.length ? catSpendEntries.map(item => `
          <div class="category-item">
            <div class="category-left">
              <span class="category-icon" style="background:${item.category.color}20">${item.category.emoji}</span>
              <div>
                <span class="category-name">${escapeHtml(item.category.name)}</span>
                <div style="font-size:12px; color:var(--text-muted);">${Math.round((item.amount / (monthExpense || 1)) * 100)}% of total</div>
              </div>
            </div>
            <span class="category-amount">${formatMoney(item.amount, currencyKey)}</span>
          </div>
        `).join('') : '<div class="empty-state">No expenses recorded for this month</div>'}
      </div>
    </div>
  `;

  // Render SVG charts
  renderBarChartSvg(document.getElementById('barChartContainer'), barDataList, currencyKey);
  renderDonutChartSvg(document.getElementById('donutChartContainer'), catSpendEntries, monthExpense, currencyKey);
  renderBalanceTimelineSvg(document.getElementById('timelineChartContainer'), timelineData, currencyKey);
}

// -------------------------------------------------------------
// TRANSACTIONS VIEW
// -------------------------------------------------------------
export function renderTransactionsView(containerEl, state) {
  const { transactions, categories, settings, ui } = state;
  const currencyKey = settings.currency;
  const viewedKey = toMonthKey(ui.viewedYearMonth);

  // Filter
  let filtered = [...transactions];

  if (ui.filterType === 'income') {
    filtered = filtered.filter(t => t.type === 'income');
  } else if (ui.filterType === 'expense') {
    filtered = filtered.filter(t => t.type === 'expense');
  } else if (ui.filterType === 'month') {
    filtered = filtered.filter(t => t.date.startsWith(viewedKey));
  }

  // Date range filter
  if (ui.dateRange.start) {
    filtered = filtered.filter(t => t.date >= ui.dateRange.start);
  }
  if (ui.dateRange.end) {
    filtered = filtered.filter(t => t.date <= ui.dateRange.end);
  }

  // Search query
  if (ui.searchQuery) {
    const q = ui.searchQuery.toLowerCase();
    filtered = filtered.filter(t => {
      const cat = getCategory(categories, t.category);
      return (t.description || '').toLowerCase().includes(q) || cat.name.toLowerCase().includes(q);
    });
  }

  // Sort options
  if (ui.sortBy === 'date-desc') {
    filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  } else if (ui.sortBy === 'date-asc') {
    filtered.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  } else if (ui.sortBy === 'amount-desc') {
    filtered.sort((a, b) => b.amount - a.amount);
  } else if (ui.sortBy === 'amount-asc') {
    filtered.sort((a, b) => a.amount - b.amount);
  }

  // Pagination
  const pageSize = ui.pageSize || 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, ui.currentPage || 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  containerEl.innerHTML = `
    <!-- Search & Filter Controls -->
    <div class="card" style="margin-bottom:20px; padding:18px;">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <div style="position:relative; flex:1; min-width:200px;">
          <span style="position:absolute; left:14px; top:12px; color:var(--text-muted);" aria-hidden="true">🔍</span>
          <input
            id="searchInput"
            type="search"
            placeholder="Search descriptions, categories..."
            value="${escapeHtml(ui.searchQuery)}"
            style="padding-left:40px; margin-bottom:0;"
            class="input"
            aria-label="Search transactions"
          />
        </div>

        <div class="filter-chips" role="radiogroup" aria-label="Transaction Type Filter">
          <button class="filter-chip ${ui.filterType === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="filter-chip ${ui.filterType === 'income' ? 'active' : ''}" data-filter="income">Income</button>
          <button class="filter-chip ${ui.filterType === 'expense' ? 'active' : ''}" data-filter="expense">Expenses</button>
          <button class="filter-chip ${ui.filterType === 'month' ? 'active' : ''}" data-filter="month">This Month</button>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <label for="sortSelect" style="font-size:12px; color:var(--text-muted);">Sort:</label>
          <select id="sortSelect" class="btn btn-sm" aria-label="Sort transactions">
            <option value="date-desc" ${ui.sortBy === 'date-desc' ? 'selected' : ''}>Newest First</option>
            <option value="date-asc" ${ui.sortBy === 'date-asc' ? 'selected' : ''}>Oldest First</option>
            <option value="amount-desc" ${ui.sortBy === 'amount-desc' ? 'selected' : ''}>Highest Amount</option>
            <option value="amount-asc" ${ui.sortBy === 'amount-asc' ? 'selected' : ''}>Lowest Amount</option>
          </select>
        </div>
      </div>

      <!-- Date Range Sub-row -->
      <div style="display:flex; gap:12px; align-items:center; margin-top:12px; flex-wrap:wrap; font-size:13px;">
        <span style="color:var(--text-muted);">Date Range:</span>
        <input type="date" id="dateRangeStart" value="${escapeHtml(ui.dateRange.start)}" class="input btn-sm" style="width:auto; margin-bottom:0;" aria-label="Start Date" />
        <span style="color:var(--text-muted);">to</span>
        <input type="date" id="dateRangeEnd" value="${escapeHtml(ui.dateRange.end)}" class="input btn-sm" style="width:auto; margin-bottom:0;" aria-label="End Date" />
        ${(ui.dateRange.start || ui.dateRange.end) ? `<button id="clearDateRangeBtn" class="btn btn-sm">Clear Dates</button>` : ''}
      </div>
    </div>

    <!-- Transactions List -->
    <div class="card" style="padding:0; overflow:hidden;">
      ${!pageItems.length ? `
        <div class="empty-state">
          <p style="font-size:24px; margin-bottom:8px;">🧾</p>
          <p>No transactions found matching your criteria</p>
          <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.floApp.openAddModal()">Add First Transaction</button>
        </div>
      ` : `
        <div role="list" aria-label="Transaction list">
          ${pageItems.map(t => {
            const cat = getCategory(categories, t.category);
            const isIncome = t.type === 'income';
            return `
              <div class="txn-row" role="listitem" style="padding:14px 20px;" tabindex="0">
                <div class="txn-left">
                  <span class="txn-icon ${isIncome ? 'income' : 'expense'}" style="background:${cat.color}20">${cat.emoji}</span>
                  <div>
                    <!-- Bug 1 fix: All user descriptions escaped -->
                    <div class="txn-name">${escapeHtml(t.description)}</div>
                    <div class="txn-meta">${escapeHtml(cat.name)} · ${formatDisplayDate(t.date)}</div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                  <span class="txn-amount ${isIncome ? 'income' : 'expense'}">
                    ${isIncome ? '+' : '-'}${formatMoney(t.amount, currencyKey)}
                  </span>
                  <!-- Phase 2: Edit & Delete buttons -->
                  <div class="txn-actions" style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-icon edit-txn-btn" data-id="${t.id}" title="Edit transaction" aria-label="Edit ${escapeHtml(t.description)}">✏️</button>
                    <button class="btn btn-sm btn-icon btn-danger delete-txn-btn" data-id="${t.id}" title="Delete transaction" aria-label="Delete ${escapeHtml(t.description)}">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <!-- Pagination Footer -->
      ${totalPages > 1 ? `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 20px; border-top:1px solid var(--border-soft); background:var(--bg-elevated);">
          <span style="font-size:13px; color:var(--text-muted);">
            Showing ${startIndex + 1}–${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length}
          </span>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-sm" id="prevPageBtn" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button>
            <span style="font-size:13px; font-weight:600; padding:6px 12px; display:flex; align-items:center;">
              ${currentPage} / ${totalPages}
            </span>
            <button class="btn btn-sm" id="nextPageBtn" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Attach event listeners
  const searchInput = containerEl.querySelector('#searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => store.setSearchQuery(e.target.value));
  }

  containerEl.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => store.setFilter(btn.dataset.filter));
  });

  const sortSelect = containerEl.querySelector('#sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => store.setSortBy(e.target.value));
  }

  const startInput = containerEl.querySelector('#dateRangeStart');
  const endInput = containerEl.querySelector('#dateRangeEnd');
  const handleDateChange = () => {
    store.setDateRange(startInput?.value || '', endInput?.value || '');
  };
  if (startInput) startInput.addEventListener('change', handleDateChange);
  if (endInput) endInput.addEventListener('change', handleDateChange);

  const clearDateBtn = containerEl.querySelector('#clearDateRangeBtn');
  if (clearDateBtn) {
    clearDateBtn.addEventListener('click', () => store.setDateRange('', ''));
  }

  const prevBtn = containerEl.querySelector('#prevPageBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => store.setPage(currentPage - 1));

  const nextBtn = containerEl.querySelector('#nextPageBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => store.setPage(currentPage + 1));

  // Edit / Delete handlers
  containerEl.querySelectorAll('.edit-txn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const t = transactions.find(item => item.id === id);
      if (t) window.floApp.openEditModal(t);
    });
  });

  containerEl.querySelectorAll('.delete-txn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      store.deleteTransaction(id);
    });
  });
}

// -------------------------------------------------------------
// BUDGETS VIEW
// -------------------------------------------------------------
export function renderBudgetsView(containerEl, state) {
  const { budgets, transactions, categories, settings, ui } = state;
  const currencyKey = settings.currency;
  const viewedKey = toMonthKey(ui.viewedYearMonth);

  // Calculate actual spending per category for viewed month
  const spentByCat = {};
  transactions.forEach(t => {
    if (t.type === 'expense' && t.date.startsWith(viewedKey)) {
      spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount;
    }
  });

  containerEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div>
        <h2 style="font-family:var(--font-display); font-size:22px; color:var(--text-primary);">Budgets</h2>
        <div style="font-size:13px; color:var(--text-muted);">Manage monthly category spending limits & rollover</div>
      </div>
      <button class="btn btn-primary" onclick="window.floApp.openBudgetModal()">+ New Budget</button>
    </div>

    ${!budgets.length ? `
      <div class="card empty-state">
        <p style="font-size:28px; margin-bottom:8px;">🎯</p>
        <p>No budgets created yet. Set spending limits to stay on track.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.floApp.openBudgetModal()">Create Budget</button>
      </div>
    ` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:20px;">
        ${budgets.map(b => {
          const cat = getCategory(categories, b.category);
          const spent = spentByCat[b.category] || 0;
          const limit = b.limit || 1;
          const pct = Math.round((spent / limit) * 100);

          // Over-budget state (not capped silently at 100%!)
          const isOverBudget = spent > limit;
          const isWarning = pct >= 80 && !isOverBudget;
          const barWidth = Math.min(pct, 100);

          const barColor = isOverBudget ? 'var(--expense)' : isWarning ? 'var(--amber)' : 'var(--income)';

          return `
            <div class="card" style="border-top: 4px solid ${barColor};" tabindex="0">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span style="font-size:28px; padding:6px; background:${cat.color}20; border-radius:12px;">${cat.emoji}</span>
                  <div>
                    <div style="font-weight:600; color:var(--text-primary); font-size:16px;">${escapeHtml(cat.name)}</div>
                    <div style="font-size:12px; color:var(--text-muted);">
                      ${b.rollover ? '🔄 Rollover enabled' : 'Standard budget'}
                    </div>
                  </div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-sm btn-icon edit-budget-btn" data-id="${b.id}" data-category="${b.category}" data-limit="${b.limit}" data-rollover="${b.rollover}" title="Edit Budget">✏️</button>
                  <button class="btn btn-sm btn-icon btn-danger delete-budget-btn" data-id="${b.id}" title="Delete Budget">🗑️</button>
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
                <span style="font-size:22px; font-weight:700; color:var(--text-primary);">${formatMoney(spent, currencyKey)}</span>
                <span style="color:var(--text-muted); font-size:14px;">limit: ${formatMoney(limit, currencyKey)}</span>
              </div>

              <!-- Budget Progress Bar -->
              <div style="height:10px; background:var(--border-soft); border-radius:6px; overflow:hidden; position:relative;">
                <div style="width:${barWidth}%; height:100%; background:${barColor}; border-radius:6px; transition:width 0.3s;"></div>
              </div>

              <!-- Warning / Over-budget Notice -->
              <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:12px;">
                <span style="font-weight:600; color:${isOverBudget ? 'var(--expense)' : isWarning ? 'var(--amber)' : 'var(--text-muted)'};">
                  ${isOverBudget ? `🚨 Over budget by ${pct}%!` : isWarning ? `⚠️ ${pct}% used (Warning)` : `${pct}% used`}
                </span>
                <span style="color:var(--text-secondary);">
                  ${isOverBudget ? 'No money left' : `${formatMoney(limit - spent, currencyKey)} remaining`}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // Attach budget edit / delete listeners
  containerEl.querySelectorAll('.edit-budget-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.floApp.openBudgetModal({
        id: btn.dataset.id,
        category: btn.dataset.category,
        limit: parseInt(btn.dataset.limit, 10),
        rollover: btn.dataset.rollover === 'true',
      });
    });
  });

  containerEl.querySelectorAll('.delete-budget-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.deleteBudget(btn.dataset.id);
    });
  });
}

// -------------------------------------------------------------
// SAVINGS GOALS VIEW
// -------------------------------------------------------------
export function renderGoalsView(containerEl, state) {
  const { goals, settings } = state;
  const currencyKey = settings.currency;

  containerEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div>
        <h2 style="font-family:var(--font-display); font-size:22px; color:var(--text-primary);">Savings Goals</h2>
        <div style="font-size:13px; color:var(--text-muted);">Track progress towards your target milestones</div>
      </div>
      <button class="btn btn-primary" onclick="window.floApp.openGoalModal()">+ New Goal</button>
    </div>

    ${!goals.length ? `
      <div class="card empty-state">
        <p style="font-size:28px; margin-bottom:8px;">💎</p>
        <p>No savings goals set yet. Save for a rainy day, vacation, or gear!</p>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.floApp.openGoalModal()">Create Goal</button>
      </div>
    ` : `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:20px;">
        ${goals.map(g => {
          const pct = Math.min(100, Math.round((g.savedAmount / (g.targetAmount || 1)) * 100));
          return `
            <div class="card" tabindex="0">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span style="font-size:32px;">${g.emoji || '🎯'}</span>
                  <div>
                    <div style="font-weight:600; font-size:17px; color:var(--text-primary);">${escapeHtml(g.name)}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${g.targetDate ? `Target: ${formatDisplayDate(g.targetDate)}` : 'No deadline'}</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-icon btn-danger delete-goal-btn" data-id="${g.id}" title="Delete Goal">🗑️</button>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
                <span style="font-size:22px; font-weight:700; color:var(--income);">${formatMoney(g.savedAmount, currencyKey)}</span>
                <span style="color:var(--text-muted); font-size:13px;">of ${formatMoney(g.targetAmount, currencyKey)}</span>
              </div>

              <!-- Progress bar -->
              <div style="height:10px; background:var(--border-soft); border-radius:6px; overflow:hidden; margin-bottom:12px;">
                <div style="width:${pct}%; height:100%; background:var(--income); border-radius:6px; transition:width 0.3s;"></div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:var(--text-muted); font-weight:600;">${pct}% reached</span>
                <button class="btn btn-sm contribute-goal-btn" data-id="${g.id}">+ Add Funds</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // Attach goal handlers
  containerEl.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => store.deleteGoal(btn.dataset.id));
  });

  containerEl.querySelectorAll('.contribute-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const amtStr = prompt('Enter amount to add to savings goal:');
      if (amtStr) {
        const minor = toMinorUnits(amtStr, currencyKey);
        if (minor > 0) store.contributeToGoal(id, minor);
      }
    });
  });
}

// -------------------------------------------------------------
// RECURRING TRANSACTIONS VIEW
// -------------------------------------------------------------
export function renderRecurringView(containerEl, state) {
  const { recurring, categories, settings } = state;
  const currencyKey = settings.currency;

  containerEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div>
        <h2 style="font-family:var(--font-display); font-size:22px; color:var(--text-primary);">Recurring Transactions</h2>
        <div style="font-size:13px; color:var(--text-muted);">Subscriptions, salaries, and recurring bills automatically generated</div>
      </div>
      <button class="btn btn-primary" onclick="window.floApp.openRecurringModal()">+ New Recurring</button>
    </div>

    ${!recurring.length ? `
      <div class="card empty-state">
        <p style="font-size:28px; margin-bottom:8px;">🔄</p>
        <p>No recurring rules set. Add rent, streaming subscriptions, or salary.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.floApp.openRecurringModal()">Setup Recurring</button>
      </div>
    ` : `
      <div class="card" style="padding:0; overflow:hidden;">
        ${recurring.map(r => {
          const cat = getCategory(categories, r.category);
          const isIncome = r.type === 'income';
          return `
            <div class="txn-row" style="padding:16px 20px;" tabindex="0">
              <div class="txn-left">
                <span class="txn-icon ${isIncome ? 'income' : 'expense'}" style="background:${cat.color}20">${cat.emoji}</span>
                <div>
                  <div class="txn-name">${escapeHtml(r.description)}</div>
                  <div class="txn-meta">${escapeHtml(cat.name)} · ${r.frequency.toUpperCase()} (from ${formatDisplayDate(r.startDate)})</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:16px;">
                <span class="txn-amount ${isIncome ? 'income' : 'expense'}">
                  ${isIncome ? '+' : '-'}${formatMoney(r.amount, currencyKey)}
                </span>
                <button class="btn btn-sm toggle-pause-btn" data-id="${r.id}">
                  ${r.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button class="btn btn-sm btn-icon btn-danger delete-recurring-btn" data-id="${r.id}" title="Delete rule">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // Recurring listeners
  containerEl.querySelectorAll('.toggle-pause-btn').forEach(btn => {
    btn.addEventListener('click', () => store.togglePauseRecurring(btn.dataset.id));
  });
  containerEl.querySelectorAll('.delete-recurring-btn').forEach(btn => {
    btn.addEventListener('click', () => store.deleteRecurring(btn.dataset.id));
  });
}

// -------------------------------------------------------------
// CUSTOM CATEGORIES VIEW
// -------------------------------------------------------------
export function renderCategoriesView(containerEl, state) {
  const { categories } = state;

  containerEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div>
        <h2 style="font-family:var(--font-display); font-size:22px; color:var(--text-primary);">Categories</h2>
        <div style="font-size:13px; color:var(--text-muted);">Manage custom categories, emojis, and colors</div>
      </div>
      <button class="btn btn-primary" onclick="window.floApp.openCategoryModal()">+ New Category</button>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px;">
      ${categories.map(c => `
        <div class="card" style="padding:16px 20px; display:flex; align-items:center; justify-content:space-between;" tabindex="0">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:24px; padding:6px; background:${c.color}20; border-radius:10px;">${c.emoji}</span>
            <div>
              <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(c.name)}</div>
              <div style="font-size:12px; color:var(--text-muted);">${c.isIncome ? '💰 Income Category' : '💸 Expense Category'}</div>
            </div>
          </div>
          ${c.id !== 'other' ? `
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-icon edit-cat-btn" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-emoji="${c.emoji}" data-color="${c.color}">✏️</button>
              <button class="btn btn-sm btn-icon btn-danger delete-cat-btn" data-id="${c.id}" data-name="${escapeHtml(c.name)}">🗑️</button>
            </div>
          ` : '<span style="font-size:11px; color:var(--text-muted);">Default</span>'}
        </div>
      `).join('')}
    </div>
  `;

  // Category listeners
  containerEl.querySelectorAll('.edit-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.floApp.openCategoryModal({
        id: btn.dataset.id,
        name: btn.dataset.name,
        emoji: btn.dataset.emoji,
        color: btn.dataset.color,
      });
    });
  });

  containerEl.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Delete category "${btn.dataset.name}"? Old transactions will be safely reassigned to "Other".`)) {
        store.deleteCategory(btn.dataset.id);
      }
    });
  });
}

// -------------------------------------------------------------
// SETTINGS VIEW
// -------------------------------------------------------------
export function renderSettingsView(containerEl, state) {
  const { settings } = state;

  containerEl.innerHTML = `
    <div class="card">
      <div class="section-title">Preferences</div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Currency</div>
          <div class="settings-row-sub">Display currency and decimal formatting</div>
        </div>
        <select id="currencySettingSelect" class="btn" style="width:auto;" aria-label="Select Currency">
          <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
          <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
          <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
          <option value="BDT" ${settings.currency === 'BDT' ? 'selected' : ''}>BDT (৳)</option>
          <option value="JPY" ${settings.currency === 'JPY' ? 'selected' : ''}>JPY (¥)</option>
          <option value="INR" ${settings.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
          <option value="PKR" ${settings.currency === 'PKR' ? 'selected' : ''}>PKR (₨)</option>
          <option value="RUB" ${settings.currency === 'RUB' ? 'selected' : ''}>RUB (₽)</option>
          <option value="KRW" ${settings.currency === 'KRW' ? 'selected' : ''}>KRW (₩)</option>
        </select>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Theme</div>
          <div class="settings-row-sub">Light, Dark, or System preference</div>
        </div>
        <select id="themeSettingSelect" class="btn" style="width:auto;" aria-label="Select Theme">
          <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>Auto (System)</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Theme</option>
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
        </select>
      </div>
    </div>

    <!-- Data Management (JSON & CSV Export/Import with UTF-8 BOM, Demo data, Clear) -->
    <div class="card" style="margin-top:20px;">
      <div class="section-title">Data Management</div>
      
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Export JSON</div>
          <div class="settings-row-sub">Complete backup of all transactions, budgets, goals & rules</div>
        </div>
        <button class="btn btn-sm" onclick="window.floApp.exportJson()">Export JSON</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Export CSV (Excel Ready)</div>
          <div class="settings-row-sub">Includes UTF-8 BOM so currency symbols (৳, €, £) open properly</div>
        </div>
        <button class="btn btn-sm" onclick="window.floApp.exportCsv()">Export CSV</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Import File (JSON or CSV)</div>
          <div class="settings-row-sub">Safe preview with option to Merge or Replace</div>
        </div>
        <button class="btn btn-sm" onclick="window.floApp.triggerFileImport()">Import File</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Load Demo Data</div>
          <div class="settings-row-sub">Populate sample transactions, budgets, goals & subscriptions</div>
        </div>
        <button class="btn btn-sm" onclick="window.floApp.loadDemo()">Load Demo</button>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label" style="color:var(--expense);">Clear All Data</div>
          <div class="settings-row-sub">Permanently delete all stored data (with Undo option)</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.floApp.clearData()">Clear All</button>
      </div>
    </div>
  `;

  // Settings listeners
  const currSel = containerEl.querySelector('#currencySettingSelect');
  if (currSel) currSel.addEventListener('change', (e) => store.setCurrency(e.target.value));

  const themeSel = containerEl.querySelector('#themeSettingSelect');
  if (themeSel) themeSel.addEventListener('change', (e) => window.floApp.setTheme(e.target.value));
}

// -------------------------------------------------------------
// CALENDAR MONTH & DAY PICKER
// -------------------------------------------------------------
export function renderCalendarDropdown(containerEl, state) {
  const ym = state.ui.viewedYearMonth;
  const grid = getCalendarGrid(ym);

  containerEl.innerHTML = `
    <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <button class="btn btn-sm" id="calPrevMonthBtn" aria-label="Previous Month">◀</button>
      <span style="font-weight:600; font-family:var(--font-display);">${formatMonthYear(ym, false)}</span>
      <button class="btn btn-sm" id="calNextMonthBtn" aria-label="Next Month">▶</button>
    </div>
    <div class="calendar-grid">
      <div class="calendar-day-header">Su</div>
      <div class="calendar-day-header">Mo</div>
      <div class="calendar-day-header">Tu</div>
      <div class="calendar-day-header">We</div>
      <div class="calendar-day-header">Th</div>
      <div class="calendar-day-header">Fr</div>
      <div class="calendar-day-header">Sa</div>
      ${grid.map(c => `
        <button
          class="calendar-day ${c.isOtherMonth ? 'other-month' : ''} ${c.isToday ? 'today' : ''} ${state.ui.selectedCalendarDay === c.dateString ? 'selected' : ''}"
          data-date="${c.dateString}"
          data-year="${c.year}"
          data-month="${c.month}"
          aria-label="${c.dateString}"
        >
          ${c.day}
        </button>
      `).join('')}
    </div>
  `;

  containerEl.querySelector('#calPrevMonthBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    store.changeMonth(-1);
  });

  containerEl.querySelector('#calNextMonthBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    store.changeMonth(1);
  });

  containerEl.querySelectorAll('.calendar-day').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const year = parseInt(btn.dataset.year, 10);
      const month = parseInt(btn.dataset.month, 10);
      const dateStr = btn.dataset.date;
      store.setViewedMonth({ year, month }, dateStr);
      window.floApp.closeCalendar();
    });
  });
}
