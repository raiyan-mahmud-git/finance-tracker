import { describe, it, expect } from 'vitest';
import { toMinorUnits, formatMoney, formatMoneyCompact } from '../js/money.js';
import { addMonths, getSixMonthWindow, formatDisplayDate } from '../js/dates.js';
import { exportToCsv, parseFromCsv } from '../js/csv.js';
import { migrateFromLegacy, validateImportPayload, CURRENT_SCHEMA_VERSION } from '../js/storage.js';

describe('Phase 2 & 5 Modules Unit Tests', () => {
  describe('Money Module', () => {
    it('accurately parses float currencies to minor units', () => {
      expect(toMinorUnits('12.34', 'USD')).toBe(1234);
      expect(toMinorUnits(99.99, 'USD')).toBe(9999);
      expect(toMinorUnits(500, 'JPY')).toBe(500); // 0 decimals
      expect(toMinorUnits('1,500.50', 'BDT')).toBe(150050);
    });

    it('formats money with Intl.NumberFormat', () => {
      expect(formatMoney(1234, 'USD')).toBe('$12.34');
      expect(formatMoney(500, 'JPY')).toBe('¥500');
      expect(formatMoney(150050, 'BDT')).toContain('1,500.50');
    });

    it('formats compact representations correctly', () => {
      expect(formatMoneyCompact(150000, 'USD')).toBe('$1,500');
    });
  });

  describe('Dates and Month Math', () => {
    it('correctly shifts months crossing year boundaries', () => {
      const dec = { year: 2026, month: 12 };
      expect(addMonths(dec, 1)).toEqual({ year: 2027, month: 1 });
      expect(addMonths(dec, -11)).toEqual({ year: 2026, month: 1 });
    });

    it('generates accurate 6-month window ending on viewed month', () => {
      const window = getSixMonthWindow({ year: 2026, month: 5 });
      expect(window.length).toBe(6);
      expect(window[5].label).toBe('May');
      expect(window[0].label).toBe('Dec');
      expect(window[0].year).toBe(2025);
    });

    it('formats display dates', () => {
      expect(formatDisplayDate('2026-10-18')).toBe('Oct 18, 2026');
    });
  });

  describe('CSV Import/Export with UTF-8 BOM', () => {
    it('exports and round-trips transactions with BDT currency symbol intact', () => {
      const txns = [
        { id: 't1', date: '2026-10-18', type: 'income', category: 'salary', description: 'Tech Salary', amount: 5000000 },
        { id: 't2', date: '2026-10-19', type: 'expense', category: 'food', description: 'Café & Lunch, "Special"', amount: 45000 }
      ];

      const csv = exportToCsv(txns, 'BDT');
      // Starts with UTF-8 BOM
      expect(csv.charCodeAt(0)).toBe(0xFEFF);
      expect(csv).toContain('Amount (BDT)');

      // Parse back
      const parsed = parseFromCsv(csv, 'BDT');
      expect(parsed.length).toBe(2);
      expect(parsed[0].amount).toBe(5000000);
      expect(parsed[0].type).toBe('income');
      expect(parsed[1].amount).toBe(45000);
      expect(parsed[1].description).toBe('Café & Lunch, "Special"');
    });
  });

  describe('Storage Migrations and Validation', () => {
    it('migrates legacy flo_state with float amounts to v2 minor units', () => {
      const legacyState = {
        currency: '৳',
        transactions: [
          { id: 'leg-1', date: '2026-04-10', amount: 150.50, type: 'expense', category: 'food', description: 'Snack' }
        ],
        budgets: [
          { id: 'b-1', category: 'food', limit: 500.00 }
        ]
      };

      const migrated = migrateFromLegacy(legacyState);
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated.settings.currency).toBe('BDT');
      expect(migrated.transactions[0].amount).toBe(15050); // 150.50 * 100 minor units
      expect(migrated.budgets[0].limit).toBe(50000); // 500.00 * 100 minor units
    });

    it('validates imported JSON payloads safely', () => {
      const bad = "not an object";
      expect(validateImportPayload(bad).valid).toBe(false);

      const good = {
        transactions: [{ id: '1', date: '2026-01-01', amount: 1000, type: 'income' }],
        budgets: [{ category: 'food', limit: 5000 }],
      };
      const res = validateImportPayload(good);
      expect(res.valid).toBe(true);
      expect(res.preview.transactionCount).toBe(1);
    });
  });
});
