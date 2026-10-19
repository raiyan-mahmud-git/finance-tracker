// js/money.js
// Handles currency configurations, conversions to minor units (cents/poisha),
// and safe formatting using standard Intl.NumberFormat without float drift.

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar ($)', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (€)', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (£)', decimals: 2 },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (৳)', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)', decimals: 0 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)', decimals: 2 },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee (₨)', decimals: 2 },
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble (₽)', decimals: 2 },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won (₩)', decimals: 0 },
};

/**
 * Resolve currency config from either a symbol (legacy, e.g. '$') or 3-letter code (e.g. 'USD')
 */
export function getCurrencyConfig(currKey = 'USD') {
  if (CURRENCIES[currKey]) return CURRENCIES[currKey];
  // Match by symbol fallback
  for (const c of Object.values(CURRENCIES)) {
    if (c.symbol === currKey) return c;
  }
  return CURRENCIES.USD;
}

/**
 * Parse human input string or float number to integer minor units (e.g. 12.50 USD -> 1250 cents)
 */
export function toMinorUnits(input, currencyKey = 'USD') {
  const conf = getCurrencyConfig(currencyKey);
  const factor = Math.pow(10, conf.decimals);
  const val = typeof input === 'number' ? input : parseFloat(String(input).replace(/,/g, ''));
  if (isNaN(val) || !isFinite(val)) return 0;
  return Math.round(val * factor);
}

/**
 * Convert integer minor units back to major float for calculations if needed
 */
export function toMajorUnits(minorUnits, currencyKey = 'USD') {
  const conf = getCurrencyConfig(currencyKey);
  const factor = Math.pow(10, conf.decimals);
  return (minorUnits || 0) / factor;
}

/**
 * Format integer minor units as currency string using standard Intl.NumberFormat
 */
export function formatMoney(minorUnits, currencyKey = 'USD') {
  const conf = getCurrencyConfig(currencyKey);
  const major = toMajorUnits(minorUnits, currencyKey);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: conf.code,
    minimumFractionDigits: conf.decimals,
    maximumFractionDigits: conf.decimals,
  }).format(major);
}

/**
 * Compact formatting for charts/summaries (e.g. $1.2k or rounded)
 */
export function formatMoneyCompact(minorUnits, currencyKey = 'USD') {
  const conf = getCurrencyConfig(currencyKey);
  const major = Math.round(toMajorUnits(minorUnits, currencyKey));
  return `${conf.symbol}${major.toLocaleString('en-US')}`;
}
