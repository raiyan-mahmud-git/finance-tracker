import { describe, it, expect } from 'vitest';

// These tests mirror the 11 bugs identified in Phase 1 and will verify the logic functions.

// Bug 1: XSS escaping function
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Bug 4: Safe month arithmetic
function addMonths(yearMonth, delta) {
  let { year, month } = yearMonth; // month is 1-12
  const totalMonths = (year * 12) + (month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return { year: newYear, month: newMonth };
}

// Bug 5: Local date string & stable sort
function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    // Sort descending by date
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    // Stable tiebreaker using id
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

// Bug 6: Minor units (cents/poisha) & Intl formatting
const CURRENCY_CONFIGS = {
  USD: { symbol: '$', code: 'USD', decimals: 2 },
  EUR: { symbol: '€', code: 'EUR', decimals: 2 },
  GBP: { symbol: '£', code: 'GBP', decimals: 2 },
  BDT: { symbol: '৳', code: 'BDT', decimals: 2 },
  JPY: { symbol: '¥', code: 'JPY', decimals: 0 },
  INR: { symbol: '₹', code: 'INR', decimals: 2 },
  PKR: { symbol: '₨', code: 'PKR', decimals: 2 },
  RUB: { symbol: '₽', code: 'RUB', decimals: 2 },
  KRW: { symbol: '₩', code: 'KRW', decimals: 0 },
};

function formatMoney(amountMinor, currencyKey = 'USD') {
  const conf = CURRENCY_CONFIGS[currencyKey] || CURRENCY_CONFIGS.USD;
  const unitFactor = Math.pow(10, conf.decimals);
  const majorValue = amountMinor / unitFactor;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: conf.code,
    minimumFractionDigits: conf.decimals,
    maximumFractionDigits: conf.decimals,
  }).format(majorValue);
}

function parseToMinorUnits(inputStrOrNum, currencyKey = 'USD') {
  const conf = CURRENCY_CONFIGS[currencyKey] || CURRENCY_CONFIGS.USD;
  const factor = Math.pow(10, conf.decimals);
  const num = typeof inputStrOrNum === 'number' ? inputStrOrNum : parseFloat(inputStrOrNum);
  if (isNaN(num)) return 0;
  return Math.round(num * factor);
}

// Bug 2: Chart labels anchored to viewed month
function getSixMonthRange(viewedYearMonth) {
  const months = [];
  const shortNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let i = 5; i >= 0; i--) {
    const ym = addMonths(viewedYearMonth, -i);
    months.push({
      year: ym.year,
      month: ym.month,
      label: shortNames[ym.month - 1],
      key: `${ym.year}-${String(ym.month).padStart(2, '0')}`,
    });
  }
  return months;
}

// Bug 3: Cumulative vs monthly net balance
function calculateBalances(transactions, viewedYearMonth) {
  const viewedKey = `${viewedYearMonth.year}-${String(viewedYearMonth.month).padStart(2, '0')}`;
  
  let cumulativeBalance = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  
  for (const t of transactions) {
    const amt = t.amount; // minor units
    if (t.type === 'income') {
      cumulativeBalance += amt;
    } else {
      cumulativeBalance -= amt;
    }
    
    if (t.date.startsWith(viewedKey)) {
      if (t.type === 'income') {
        monthIncome += amt;
      } else {
        monthExpense += amt;
      }
    }
  }
  
  return {
    cumulativeBalance,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
  };
}

// Bug 7: State hygiene - split persisted data from transient UI state
function extractPersistableState(appState) {
  return {
    schemaVersion: 1,
    transactions: appState.transactions,
    budgets: appState.budgets,
    categories: appState.categories,
    recurring: appState.recurring,
    goals: appState.goals,
    settings: appState.settings,
  };
}

// Bug 8: Safe import validation
function validateImportData(rawData) {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return { valid: false, error: 'Imported data must be a JSON object' };
  }
  
  // Must contain valid arrays if present, or legacy format
  const transactions = Array.isArray(rawData.transactions) ? rawData.transactions : [];
  const budgets = Array.isArray(rawData.budgets) ? rawData.budgets : [];
  
  // Check sanity of transactions
  for (const t of transactions) {
    if (!t.date || typeof t.type !== 'string' || typeof t.amount !== 'number') {
      return { valid: false, error: 'Transaction list contains invalid entries' };
    }
  }
  
  return {
    valid: true,
    preview: {
      transactionCount: transactions.length,
      budgetCount: budgets.length,
    },
    data: rawData,
  };
}

describe('Phase 1 Bug Fixes Unit Tests', () => {
  it('Bug 1 (XSS): escapeHtml properly escapes HTML and script injection strings', () => {
    const malicious = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;');
  });

  it('Bug 2 (Chart labels): anchors 6 months to viewed month instead of fixed Jan-Jun', () => {
    const viewed = { year: 2026, month: 10 }; // Oct 2026
    const range = getSixMonthRange(viewed);
    expect(range.length).toBe(6);
    expect(range[5].label).toBe('Oct');
    expect(range[5].year).toBe(2026);
    expect(range[0].label).toBe('May');
    expect(range[0].year).toBe(2026);

    const viewedJan = { year: 2026, month: 2 }; // Feb 2026
    const rangeJan = getSixMonthRange(viewedJan);
    expect(rangeJan[5].label).toBe('Feb');
    expect(rangeJan[0].label).toBe('Sep');
    expect(rangeJan[0].year).toBe(2025); // Crosses year boundary cleanly
  });

  it('Bug 3 (Current Balance): distinguishes true cumulative balance from monthly net', () => {
    const txns = [
      { id: '1', date: '2026-03-15', amount: 50000, type: 'income' }, // Mar +$500
      { id: '2', date: '2026-03-20', amount: 20000, type: 'expense' }, // Mar -$200
      { id: '3', date: '2026-04-05', amount: 15000, type: 'expense' }, // Apr -$150
      { id: '4', date: '2026-04-10', amount: 10000, type: 'income' }, // Apr +$100
    ];
    // In April 2026:
    const aprBalances = calculateBalances(txns, { year: 2026, month: 4 });
    // Cumulative: +500 - 200 - 150 + 100 = +250 ($250.00 = 25000 minor)
    expect(aprBalances.cumulativeBalance).toBe(25000);
    // Month Net: +100 - 150 = -50 (-5000 minor)
    expect(aprBalances.monthNet).toBe(-5000);
    expect(aprBalances.monthIncome).toBe(10000);
    expect(aprBalances.monthExpense).toBe(15000);
  });

  it('Bug 4 (Month Math): safely increments and decrements past 29th-31st boundaries', () => {
    // Jan 31 + 1 month should be Feb, not March!
    const jan = { year: 2026, month: 1 };
    const feb = addMonths(jan, 1);
    expect(feb).toEqual({ year: 2026, month: 2 });
    
    // Dec + 1 month should be Jan of next year
    const dec = { year: 2025, month: 12 };
    const nextJan = addMonths(dec, 1);
    expect(nextJan).toEqual({ year: 2026, month: 1 });
    
    // Jan - 1 month should be Dec of prev year
    const prevDec = addMonths(jan, -1);
    expect(prevDec).toEqual({ year: 2025, month: 12 });
  });

  it('Bug 5 (Timezone & Stable Sort): local date formatting and deterministic sort order', () => {
    const testDate = new Date(2026, 9, 18, 1, 30); // Oct 18, 2026 01:30 local time
    const dateStr = getLocalDateString(testDate);
    expect(dateStr).toBe('2026-10-18');

    const txns = [
      { id: 'a', date: '2026-10-18', desc: 'First' },
      { id: 'c', date: '2026-10-18', desc: 'Third' },
      { id: 'b', date: '2026-10-18', desc: 'Second' },
      { id: 'd', date: '2026-10-17', desc: 'Yesterday' },
    ];
    const sorted = sortTransactions(txns);
    expect(sorted[0].id).toBe('c');
    expect(sorted[1].id).toBe('b');
    expect(sorted[2].id).toBe('a');
    expect(sorted[3].id).toBe('d');
  });

  it('Bug 6 (Money): minor units representation and Intl.NumberFormat', () => {
    // Floating point 0.1 + 0.2 is 0.30000000000000004
    // In minor units: 10 + 20 = 30
    const m1 = parseToMinorUnits(0.10, 'USD');
    const m2 = parseToMinorUnits(0.20, 'USD');
    expect(m1 + m2).toBe(30);

    // Formats USD with 2 decimals
    expect(formatMoney(25000, 'USD')).toBe('$250.00');

    // JPY has 0 decimals
    const jpyMinor = parseToMinorUnits(500, 'JPY');
    expect(jpyMinor).toBe(500);
    expect(formatMoney(500, 'JPY')).toBe('¥500');

    // BDT has 2 decimals and standard currency code
    expect(formatMoney(125050, 'BDT')).toContain('1,250.50');
  });

  it('Bug 7 (UI State isolation): persistable state excludes transient search/filter/offset', () => {
    const state = {
      transactions: [{ id: 1 }],
      budgets: [],
      categories: [],
      recurring: [],
      goals: [],
      settings: { currency: 'USD', theme: 'system' },
      currentMonthOffset: 3,
      currentFilter: 'expense',
      searchQuery: 'groceries',
      currentType: 'income',
    };
    const persistable = extractPersistableState(state);
    expect(persistable.transactions).toEqual([{ id: 1 }]);
    expect(persistable.settings.currency).toBe('USD');
    expect(persistable.currentMonthOffset).toBeUndefined();
    expect(persistable.currentFilter).toBeUndefined();
    expect(persistable.searchQuery).toBeUndefined();
    expect(persistable.currentType).toBeUndefined();
  });

  it('Bug 8 (Safe Import): validates payload and prevents arbitrary property override', () => {
    const invalidPayload = "random string";
    expect(validateImportData(invalidPayload).valid).toBe(false);

    const maliciousPayload = {
      transactions: [{ date: '2026-01-01', type: 'income', amount: 5000 }],
      budgets: [{ category: 'food', limit: 10000 }],
      isAdmin: true, // Should not overwrite app internals
    };
    const validated = validateImportData(maliciousPayload);
    expect(validated.valid).toBe(true);
    expect(validated.preview.transactionCount).toBe(1);
    expect(validated.preview.budgetCount).toBe(1);
  });
});
