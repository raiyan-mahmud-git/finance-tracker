import { SUPPORTED_CURRENCIES } from '../money.ts';
import type { AppState } from '../store.ts';

export function renderSettingsView(state: AppState): string {
  const currentCurrency = state.data.settings.currency;
  const currentTheme = state.data.settings.theme;

  return `
    <div class="settings-view animate-fade-in" style="display:flex; flex-direction:column; gap:24px; max-width:800px; margin:0 auto;">

      <div class="card">
        <h2 style="font-size:18px; font-weight:700; color:var(--text-primary); margin-bottom:16px;">
          Preferences
        </h2>

        <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid var(--border-soft);">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">Base Currency</div>
            <div style="font-size:12px; color:var(--text-muted);">Formatted using Intl.NumberFormat</div>
          </div>
          <select
            id="setting-currency"
            class="btn"
            style="padding:8px 12px; font-size:13px;"
            onchange="window.floApp.updateCurrency(this.value)"
            aria-label="Select display currency"
          >
            ${Object.values(SUPPORTED_CURRENCIES).map(c => `
              <option value="${c.code}" ${currentCurrency === c.code ? 'selected' : ''}>
                ${c.code} (${c.symbol}) — ${c.name}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid var(--border-soft);">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">Appearance Theme</div>
            <div style="font-size:12px; color:var(--text-muted);">Auto-detects system theme unless manually chosen</div>
          </div>
          <select
            id="setting-theme"
            class="btn"
            style="padding:8px 12px; font-size:13px;"
            onchange="window.floApp.updateTheme(this.value)"
            aria-label="Select color theme"
          >
            <option value="system" ${currentTheme === 'system' ? 'selected' : ''}>💻 System Default</option>
            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>☀️ Light Theme</option>
            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>🌙 Dark Theme</option>
          </select>
        </div>

        <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 0;">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">Custom Categories</div>
            <div style="font-size:12px; color:var(--text-muted);">${state.data.categories.length} active categories</div>
          </div>
          <button type="button" class="btn btn-sm" onclick="window.floApp.openCategoryModal()">
            Manage Categories
          </button>
        </div>
      </div>

      <div class="card sample-data-card" style="background:var(--bg-elevated); border:1px solid var(--border-medium);">
        <div class="sample-data-content" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="sample-data-description">
            <h3 style="font-size:16px; font-weight:700; color:var(--text-primary);">
              Sample Dataset
            </h3>
            <p style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
              Loads realistic starter data with transactions, budgets, and goals to explore the features.
            </p>
          </div>
          <div class="sample-data-actions" style="display:flex; gap:8px;">
            <button type="button" class="btn btn-primary" onclick="window.floApp.loadSampleData()">
              Load Sample Data
            </button>
            <button type="button" class="btn" onclick="window.floApp.resetToBlankData()">
              Reset to Blank
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 style="font-size:18px; font-weight:700; color:var(--text-primary); margin-bottom:16px;">
          Data Backup & Transfer
        </h2>

        <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid var(--border-soft); flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">JSON Full Backup</div>
            <div style="font-size:12px; color:var(--text-muted);">Exports all transactions, budgets, goals, and categories</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-sm" onclick="window.floApp.exportJSON()">Export JSON</button>
            <button type="button" class="btn btn-sm" onclick="window.floApp.triggerImportFile('json')">Import JSON</button>
          </div>
        </div>

        <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid var(--border-soft); flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">Excel CSV Export / Import</div>
            <div style="font-size:12px; color:var(--text-muted);">Includes UTF-8 BOM so currency symbols (৳, ¥, €) open cleanly</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-sm" onclick="window.floApp.exportCSV()">Export CSV</button>
            <button type="button" class="btn btn-sm" onclick="window.floApp.triggerImportFile('csv')">Import CSV</button>
          </div>
        </div>

        <input type="file" id="json-file-input" accept=".json" style="display:none;" onchange="window.floApp.onJSONFileSelected(event)">
        <input type="file" id="csv-file-input" accept=".csv" style="display:none;" onchange="window.floApp.onCSVFileSelected(event)">

        <div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:14px 0;">
          <div>
            <div style="font-weight:600; font-size:14px; color:var(--expense);">Clear All Records</div>
            <div style="font-size:12px; color:var(--text-muted);">Permanently removes stored transactions and reset storage</div>
          </div>
          <button type="button" class="btn btn-danger btn-sm" onclick="window.floApp.clearAllData()">
            Clear All Data
          </button>
        </div>
      </div>

      <div class="card" style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
        <h3 style="font-weight:700; color:var(--text-primary); margin-bottom:8px;">
          🛡️ Privacy & Local Architecture
        </h3>
        <p style="margin-bottom:8px;">
          Flo runs <strong>100% locally in your browser</strong> with no backend servers, telemetry, or external API calls.
          All data is persisted in browser storage and protected against script injection (XSS).
        </p>
        <p>
          Fast, lightweight, accessible SVG charts, and compliant PWA offline support.
        </p>
      </div>
    </div>
  `;
}
