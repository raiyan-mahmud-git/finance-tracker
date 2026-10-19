// js/csv.js
// CSV export and import with UTF-8 BOM so Bangladeshi Taka (৳) and other unicode currency symbols
// open seamlessly in Microsoft Excel and spreadsheet tools.

import { toMinorUnits, toMajorUnits, getCurrencyConfig } from './money.js';

/**
 * Generate CSV string with UTF-8 BOM
 */
export function exportToCsv(transactions, currencyKey = 'USD') {
  const conf = getCurrencyConfig(currencyKey);
  const headers = ['ID', 'Date', 'Type', 'Category', 'Description', `Amount (${conf.code})`];

  const rows = transactions.map(t => {
    const majorAmount = toMajorUnits(t.amount, currencyKey);
    const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
    return [t.id, t.date, t.type, t.category, desc, majorAmount.toFixed(conf.decimals)].join(',');
  });

  // Prepend UTF-8 Byte Order Mark (BOM: \uFEFF)
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return csvContent;
}

/**
 * Parse CSV string back into transaction objects
 */
export function parseFromCsv(csvText, currencyKey = 'USD') {
  if (!csvText) return [];

  // Remove potential BOM
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return []; // Header only or empty

  const transactions = [];

  // Parse header to find column indices
  const headerCols = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const dateIdx = headerCols.findIndex(h => h.includes('date'));
  const typeIdx = headerCols.findIndex(h => h.includes('type'));
  const catIdx = headerCols.findIndex(h => h.includes('category'));
  const descIdx = headerCols.findIndex(h => h.includes('desc'));
  const amtIdx = headerCols.findIndex(h => h.includes('amount'));

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const dateVal = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx].trim() : '';
    const typeVal = typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx].trim().toLowerCase() : 'expense';
    const catVal = catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim().toLowerCase() : 'other';
    const descVal = descIdx !== -1 && cols[descIdx] ? cols[descIdx].trim() : '';
    const amtRaw = amtIdx !== -1 && cols[amtIdx] ? cols[amtIdx].trim() : '0';

    if (!dateVal || !amtRaw) continue;

    const amountMinor = toMinorUnits(amtRaw, currencyKey);

    transactions.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: dateVal,
      type: typeVal === 'income' ? 'income' : 'expense',
      category: catVal || 'other',
      description: descVal || (typeVal === 'income' ? 'Income' : 'Expense'),
      amount: amountMinor,
    });
  }

  return transactions;
}

/**
 * Safe CSV row splitter that respects quoted strings
 */
function parseCsvLine(text) {
  const result = [];
  let curr = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        curr += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(curr);
      curr = '';
    } else {
      curr += char;
    }
  }
  result.push(curr);
  return result;
}
