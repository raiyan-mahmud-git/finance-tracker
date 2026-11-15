/**
 * Header and Navigation Component
 * Clean, production-grade navigation without any portfolio badges or clunky UI elements.
 */

import { formatYearMonth, formatYearMonthFull, getDaysInMonth, getFirstWeekdayOfMonth, MONTH_NAMES_SHORT } from '../dates.ts';
import type { YearMonth } from '../dates.ts';
import { store, AppState } from '../store.ts';

export function renderNavbar(state: AppState): string {
  const ym = state.ui.viewedYearMonth;
  const monthLabel = formatYearMonth(ym);
  const activeView = state.ui.activeView;

  return `
    <header class="dashboard-header" role="banner" style="display:flex; align-items:center; justify-content:space-between; padding:18px 0; border-bottom:1px solid var(--border-soft); margin-bottom:24px;">
      <!-- Brand Logo -->
      <div style="display:flex; align-items:center; gap:28px;">
        <a href="#dashboard" onclick="event.preventDefault(); window.floApp.switchView('dashboard')" style="display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit;" aria-label="Flo Home">
          <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, var(--indigo), #10B981); display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:18px; box-shadow:var(--shadow-sm);">
            F
          </div>
          <span style="font-size:22px; font-weight:800; letter-spacing:-0.5px; color:var(--text-primary);">Flo</span>
        </a>

        <!-- Desktop Navigation Tabs -->
        <nav class="desktop-nav" aria-label="Primary navigation">
          <button type="button" class="nav-tab ${activeView === 'dashboard' ? 'active' : ''}" onclick="window.floApp.switchView('dashboard')">
            📊 Dashboard
          </button>
          <button type="button" class="nav-tab ${activeView === 'transactions' ? 'active' : ''}" onclick="window.floApp.switchView('transactions')">
            📋 Transactions
          </button>
          <button type="button" class="nav-tab ${activeView === 'budgets' ? 'active' : ''}" onclick="window.floApp.switchView('budgets')">
            🎯 Budgets & Recurring
          </button>
          <button type="button" class="nav-tab ${activeView === 'goals' ? 'active' : ''}" onclick="window.floApp.switchView('goals')">
            🌱 Goals
          </button>
          <button type="button" class="nav-tab ${activeView === 'settings' ? 'active' : ''}" onclick="window.floApp.switchView('settings')">
            ⚙️ Settings
          </button>
        </nav>
      </div>

      <!-- Controls Right: Month Picker, Clean New Transaction Button, Theme Toggle -->
      <div class="header-controls" style="display:flex; align-items:center; gap:10px;">
        <!-- Month Picker Dropdown Anchor -->
        <div style="position:relative;" id="month-picker-container">
          <div class="month-badge" onclick="window.floApp.toggleCalendar(event)" role="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Select month or date. Current: ${monthLabel}">
            <button type="button" onclick="event.stopPropagation(); window.floApp.changeMonth(-1)" aria-label="Previous month" class="month-nav-btn">◀</button>
            <span id="current-month-label" style="font-weight:600; font-size:13px; color:var(--text-primary); cursor:pointer;">
              ${monthLabel}
            </span>
            <button type="button" onclick="event.stopPropagation(); window.floApp.changeMonth(1)" aria-label="Next month" class="month-nav-btn">▶</button>
          </div>

          <!-- Calendar / Month Picker Dropdown -->
          <div id="calendar-dropdown" class="calendar-dropdown" style="display:none;" role="dialog" aria-label="Month and day selector">
            ${renderCalendarDropdown(ym, state.ui.selectedDay)}
          </div>
        </div>

        <!-- Sleek New Transaction Button with keyboard badge -->
        <button type="button" class="add-txn-btn" onclick="window.floApp.openAddTransactionModal()" title="Add Transaction (Keyboard shortcut: N)">
          <span style="font-size:16px; font-weight:700; line-height:1;">+</span>
          <span>New Transaction</span>
          <kbd class="kbd-shortcut">N</kbd>
        </button>

        <!-- Theme Toggle -->
        <button type="button" class="btn btn-sm" onclick="window.floApp.toggleTheme()" aria-label="Toggle dark or light theme" title="Toggle theme" style="padding:6px 10px; font-size:14px;">
          ${state.data.settings.theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <!-- PWA Install Button Container -->
        <div id="pwa-install-container"></div>
      </div>
    </header>
  `;
}

/**
 * Renders the interactive calendar & month picker
 */
export function renderCalendarDropdown(ym: YearMonth, selectedDay: number | null): string {
  const daysInMonth = getDaysInMonth(ym.year, ym.month);
  const firstDayWeekday = getFirstWeekdayOfMonth(ym.year, ym.month);
  const today = new Date();
  const isCurrentRealMonth = today.getFullYear() === ym.year && today.getMonth() === ym.month;
  const todayDate = today.getDate();

  let daysHtml = '';
  for (let i = 0; i < firstDayWeekday; i++) {
    daysHtml += `<div class="calendar-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentRealMonth && d === todayDate;
    const isSelected = selectedDay === d;
    let className = 'calendar-day';
    if (isToday) className += ' today';
    if (isSelected) className += ' selected';

    daysHtml += `
      <button type="button" class="${className}" onclick="window.floApp.selectCalendarDay(${d})" aria-label="${MONTH_NAMES_SHORT[ym.month]} ${d}, ${ym.year}">
        ${d}
      </button>
    `;
  }

  return `
    <div style="width:280px; padding:16px;">
      <!-- Month & Year navigation -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <button type="button" class="btn btn-sm" onclick="window.floApp.changeMonth(-1)" aria-label="Previous month">◀</button>
        <span style="font-weight:700; font-size:14px; color:var(--text-primary);">
          ${formatYearMonthFull(ym)}
        </span>
        <button type="button" class="btn btn-sm" onclick="window.floApp.changeMonth(1)" aria-label="Next month">▶</button>
      </div>

      <!-- Quick month pills -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border-soft);">
        ${MONTH_NAMES_SHORT.map((m, idx) => `
          <button type="button" class="month-pill ${ym.month === idx ? 'active' : ''}" onclick="window.floApp.selectMonth(${idx})" style="padding:4px; font-size:11px; border-radius:6px; font-weight:600; text-align:center;">
            ${m}
          </button>
        `).join('')}
      </div>

      <!-- Days Grid Header -->
      <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; text-align:center; font-size:10px; font-weight:700; color:var(--text-muted); margin-bottom:4px;">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>

      <!-- Days Grid -->
      <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:2px;">
        ${daysHtml}
      </div>

      <!-- Today jumper -->
      <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:8px; border-top:1px solid var(--border-soft);">
        <button type="button" class="btn btn-sm" style="font-size:11px; width:100%;" onclick="window.floApp.jumpToCurrentMonth()">
          Jump to Today
        </button>
      </div>
    </div>
  `;
}
