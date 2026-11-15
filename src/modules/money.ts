/**
 * Money utilities
 * Storing money as floating point numbers causes precision loss (e.g., 0.1 + 0.2 = 0.30000000000000004).
 * We store all monetary amounts as integer minor units (cents, pence, poisha, yen).
 * All formatting uses Intl.NumberFormat to respect locale rules, correct fractional digits per currency,
 * and appropriate thousands separators.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  decimals: number;
  name: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  INR: { code: 'INR', symbol: '₹', decimals: 2, name: 'Indian Rupee' },
  BDT: { code: 'BDT', symbol: '৳', decimals: 2, name: 'Bangladeshi Taka' },
  PKR: { code: 'PKR', symbol: '₨', decimals: 2, name: 'Pakistani Rupee' },
  RUB: { code: 'RUB', symbol: '₽', decimals: 2, name: 'Russian Ruble' },
  KRW: { code: 'KRW', symbol: '₩', decimals: 0, name: 'South Korean Won' },
};

/**
 * Resolves legacy currency symbol (e.g. '$' or '€') to standard ISO 4217 currency code.
 */
export function resolveCurrencyCode(symbolOrCode: string): string {
  if (SUPPORTED_CURRENCIES[symbolOrCode]) {
    return symbolOrCode;
  }
  for (const [code, cfg] of Object.entries(SUPPORTED_CURRENCIES)) {
    if (cfg.symbol === symbolOrCode) return code;
  }
  return 'USD';
}

export function getCurrencyConfig(codeOrSymbol: string): CurrencyConfig {
  const code = resolveCurrencyCode(codeOrSymbol);
  return SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.USD;
}

/**
 * Converts user input decimal amount (e.g., 12.50) to integer minor units (e.g., 1250 cents).
 * Uses Math.round to safely avoid floating point IEEE 754 precision artifacts.
 */
export function toMinorUnits(amount: number, codeOrSymbol = 'USD'): number {
  if (!Number.isFinite(amount)) return 0;
  const cfg = getCurrencyConfig(codeOrSymbol);
  const factor = 10 ** cfg.decimals;
  return Math.round(amount * factor);
}

/**
 * Converts integer minor units back to major units (for editing inputs).
 */
export function fromMinorUnits(minorUnits: number, codeOrSymbol = 'USD'): number {
  if (!Number.isFinite(minorUnits)) return 0;
  const cfg = getCurrencyConfig(codeOrSymbol);
  const factor = 10 ** cfg.decimals;
  return minorUnits / factor;
}

/**
 * Formats minor units using Intl.NumberFormat. Never uses .toFixed() for display logic.
 */
export function formatMoney(minorUnits: number, codeOrSymbol = 'USD', locale = 'en-US'): string {
  const cfg = getCurrencyConfig(codeOrSymbol);
  const value = fromMinorUnits(minorUnits, cfg.code);

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cfg.code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    });
    return formatter.format(value);
  } catch {
    return `${cfg.symbol}${value.toLocaleString(locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    })}`;
  }
}

/**
 * Formats minor units in a compact form without cents (e.g., $1,250 or ৳1,500).
 */
export function formatMoneyCompact(minorUnits: number, codeOrSymbol = 'USD', locale = 'en-US'): string {
  const cfg = getCurrencyConfig(codeOrSymbol);
  const value = Math.round(fromMinorUnits(minorUnits, cfg.code));
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cfg.code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(value);
  } catch {
    return `${cfg.symbol}${value.toLocaleString(locale)}`;
  }
}
