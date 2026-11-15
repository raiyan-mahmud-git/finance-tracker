# Changelog

All notable changes to the Flo personal finance tracker project are documented in this file.

## [2.0.0] - 2026-10-18

### Phase 1 — Bug Fixes
- **Security (XSS)**: Fixed vulnerability where transaction descriptions were inserted directly into template literals without HTML entity escaping. All user text is now audited and escaped via `escapeHtml()`.
- **Chart Month Anchoring**: Dynamic 6-month bar chart range is now anchored to the actively viewed month instead of hardcoded to Jan–Jun.
- **True Cumulative Balance**: Replaced month-only balance with true cumulative net balance across all recorded transactions, displaying viewed month net separately.
- **Safe Month Math**: Replaced buggy `setMonth(getMonth() + offset)` (which jumped Jan 31st to March) with modular arithmetic on `{ year, month }` objects.
- **Local Timezone Formatting**: Replaced `new Date().toISOString().split('T')[0]` with local date formatting `YYYY-MM-DD` and added stable multi-key sorting (date desc + creation tiebreaker).
- **Integer Minor Units & Money Precision**: Stored all monetary amounts as integer cents/paisa/yen to eliminate IEEE-754 float precision loss. Formatted with `Intl.NumberFormat` across 9+ currencies.
- **State Segregation**: Decoupled persistent data from ephemeral UI state (`currentMonthOffset`, `currentFilter`, `searchQuery`, `currentType`), saving only domain entities to storage.
- **Safe Import Schema**: Added strict validation, file preview counters, and Merge vs Replace strategies.
- **Interactive Calendar & Day Jump**: Replaced static calendar with interactive day selection that jumps to that date in transactions view, plus quick month picker.
- **Accessible Viewport**: Removed contradictory `maximum-scale=1` and `user-scalable=yes` to meet WCAG 2.1 AA zoom requirements.

### Phase 2 — Core Features
- **Edit & Delete with Undo**: Added complete editing and deletion flows for transactions and budgets with a 5-second `aria-live` Undo toast.
- **Custom Categories**: Added custom category creation (name, emoji, color) and safe deletion with transaction reassignment.
- **Automated Recurring Transactions**: Weekly and monthly rule processor with automatic generation and pause/resume switches.
- **Over-Budget & Rollover**: Uncapped percentage calculation (>100% highlighted), warning at 80%, and optional unspent rollover surplus.
- **Savings Goals**: Goal tracking with target amounts, dates, progress bars, and quick contribution modal.
- **Accessible SVG Charts**: Lightweight inline SVG charts (6-month bar comparison, category donut, cash flow trend area chart) with keyboard focus and tooltips.
- **Spending Insights**: Real-time spending pace diagnostic ("On track" / "Over pace"), average daily spend, projected month-end, and category change delta.
- **Excel CSV Export/Import**: Full UTF-8 BOM (`\uFEFF`) support preserving currency symbols (৳, ¥, €, £).

### Phase 3 — Architecture & PWA
- **Modular TypeScript (Vanilla)**: Upgraded from single 1250-line index.html to clean ES modules (`store`, `storage`, `money`, `dates`, `charts`, `views`, `components`).
- **Pub/Sub Store**: Single source of truth reactive store.
- **Storage Migration**: Non-breaking automatic migration from legacy `flo_state` / `flo_theme`.
- **Offline PWA**: Web App Manifest, auto-updating service worker, and in-app install prompt.
- **Static GitHub Pages**: Updated `.github/workflows/static.yml` for automated CI test, build, and deploy.

### Phase 4 & 5 — UX, Quality & Accessibility
- WCAG 2.1 AA compliance: semantic `<button>`, `<nav>`, and native `<dialog>` elements with Escape key and focus trap.
- Dual theme support (System default, Light, Dark).
- Comprehensive Vitest unit test suite (13 passing tests) and Playwright E2E suite.
- Quick-add keyboard shortcut (press `N` anywhere).
