# Flo — Personal Finance Tracker

"Flo" is a modern, privacy-first personal finance tracker that runs **100% in your browser** with vanilla HTML, CSS, and modern JavaScript ES modules.

- 🔒 **Zero Backend & No Tracking**: All data is stored privately on your machine using `localStorage`. No accounts, no subscriptions, no paid APIs.
- ⚡ **Zero Build Step**: Native browser ES modules — no bundlers (Webpack, Vite, Rollup) required for running the application.
- 📱 **Progressive Web App (PWA)**: Installable on Desktop, iOS, and Android with complete offline functionality via Service Workers.

---

## 🚀 Getting Started Locally

> **Important Note on ES Modules:**  
> Modern browsers block JavaScript ES modules (`import`/`export`) when opened directly via file double-click (`file://`) due to standard CORS security policies.  
> You must run a lightweight local static server:

### Option A: VS Code Live Server
1. Open the folder in VS Code.
2. Click **Go Live** on the bottom status bar (or right-click `index.html` → *Open with Live Server*).

### Option B: Python (Built-in)
```bash
# Python 3
python -m http.server 3000
# Then visit http://localhost:3000
```

### Option C: Node.js
```bash
npm start
# Launches local static server at http://localhost:3000
```

---

## 🛠️ Development & Quality Commands

```bash
# Install test tools (Vitest, Playwright, ESLint)
npm install

# Run Vitest unit tests
npm test

# Run ESLint check
npm run lint

# Run Playwright end-to-end tests
npm run test:e2e
```

---

## 🌟 Key Features & Improvements

### 1. Fixes for Real Financial Application Bugs
- **XSS Prevention**: User transaction descriptions and categories are sanitized and escaped.
- **Dynamic Chart Labels**: 6-month bar chart dynamically generates month labels anchored to the viewed month, safely handling year transitions.
- **True Cumulative Balance**: Displays your true lifetime balance in the hero card, with current month net presented separately.
- **Safe Month Math**: Prevents 29th–31st overflow bugs (e.g. Jan 31 + 1 month safely becomes Feb) by modeling dates as `{ year, month }`.
- **Timezone Safety**: Dates use local time formatting (`YYYY-MM-DD`) instead of `toISOString().split('T')[0]` which causes post-midnight bugs in positive UTC zones (e.g., UTC+6).
- **Exact Money Math**: All amounts stored internally as integer minor units (e.g. cents/poisha) and formatted via `Intl.NumberFormat`, completely eliminating float rounding drift.
- **UI State Hygiene**: Filters, searches, and calendar selections are kept in transient memory, preserving clean state across reloads.
- **Safe Imports**: Strict payload validation with live preview and choices for **Merge** or **Replace**.
- **Accessible Month/Day Picker**: Clickable calendar grid allowing navigation to any month and day.
- **Valid Viewport**: Removed invalid contradictory viewport scales for optimal mobile zooming accessibility.

### 2. Core Functional Upgrades
- **Full CRUD with Undo Toast**: Add, edit, and delete transactions and budgets with an interactive 4-second Undo toast.
- **Custom Categories**: Create categories with custom names, emojis, and colors; old transactions are safely reassigned upon deletion.
- **Recurring Transactions**: Set up monthly or weekly subscriptions and salaries with automatic generation and pause/resume.
- **Rich SVG Charts**: 6-month bar chart, spending donut breakdown, and balance timeline area chart — 100% lightweight inline SVG with tooltips and keyboard navigation.
- **Monthly Insights**: Average daily spend, projected month-end spend, and biggest spending shifts vs. the previous month.
- **Excel-Ready CSV**: CSV export prepends a UTF-8 Byte Order Mark (BOM) ensuring Bangladeshi Taka (`৳`), Euro (`€`), and Pound (`£`) render properly in Excel.
- **Dark Mode**: Automatically respects OS preference or lets users manually lock Light/Dark.
- **Demo Data with Undo**: Populate realistic transactions, budgets, goals, and subscriptions with one click and instant undo.
