/**
 * Lightweight, accessible SVG charts
 *
 * Requirements:
 * - 6-Month bar chart: dynamically anchored to viewed month with real month labels.
 * - Donut chart: category spending distribution with center total and interactive legend.
 * - Line/Area chart: net cash flow / balance trend over time with smooth SVG gradient.
 * - Accessible: ARIA labels, semantic roles, focusable data points, and keyboard navigation.
 * - Zero third-party heavy dependencies.
 */

import { addMonths, formatYearMonth, getSixMonthRange, isDateInYearMonth } from './dates.ts';
import type { YearMonth } from './dates.ts';
import { formatMoney, formatMoneyCompact } from './money.ts';
import type { Category, Transaction } from './types.ts';

// -------------------------------------------------------------
// 1. 6-MONTH COMPARISON BAR CHART (INCOME VS EXPENSE)
// -------------------------------------------------------------
export function renderBarChartSVG(
  transactions: Transaction[],
  viewedYM: YearMonth,
  currency: string
): string {
  const range = getSixMonthRange(viewedYM);
  const data = range.map(ym => {
    const monthTxns = transactions.filter(t => isDateInYearMonth(t.date, ym));
    const income = monthTxns.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const expense = monthTxns.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    return {
      ym,
      label: formatYearMonth(ym),
      income,
      expense,
      isCurrent: ym.year === viewedYM.year && ym.month === viewedYM.month,
    };
  });

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);

  const width = 600;
  const height = 180;
  const chartBottom = 140;
  const chartTop = 20;
  const availHeight = chartBottom - chartTop;

  const barGroupWidth = width / range.length;
  const barWidth = 14;
  const barGap = 4;

  const barsSvg = data.map((d, i) => {
    const groupCenterX = i * barGroupWidth + barGroupWidth / 2;
    const incX = groupCenterX - barWidth - barGap / 2;
    const expX = groupCenterX + barGap / 2;

    const incH = Math.max(3, Math.round((d.income / maxVal) * availHeight));
    const expH = Math.max(3, Math.round((d.expense / maxVal) * availHeight));

    const incY = chartBottom - incH;
    const expY = chartBottom - expH;

    const activeStroke = d.isCurrent ? 'stroke="var(--indigo)" stroke-width="2"' : '';

    return `
      <g class="bar-group" tabindex="0" role="group" aria-label="${d.label}: Income ${formatMoney(d.income, currency)}, Expense ${formatMoney(d.expense, currency)}">
        <!-- Income Bar -->
        <rect x="${incX}" y="${incY}" width="${barWidth}" height="${incH}" rx="3" fill="var(--income)" opacity="0.9" class="chart-bar-rect">
          <title>${d.label} Income: ${formatMoney(d.income, currency)}</title>
        </rect>
        <!-- Expense Bar -->
        <rect x="${expX}" y="${expY}" width="${barWidth}" height="${expH}" rx="3" fill="var(--expense)" opacity="0.9" class="chart-bar-rect">
          <title>${d.label} Expense: ${formatMoney(d.expense, currency)}</title>
        </rect>
        <!-- X-axis Label -->
        <text x="${groupCenterX}" y="${chartBottom + 18}" text-anchor="middle" font-size="11" font-weight="${d.isCurrent ? '700' : '550'}" fill="${d.isCurrent ? 'var(--indigo)' : 'var(--text-muted)'}">
          ${d.label.split(' ')[0]}
        </text>
        ${d.isCurrent ? `<circle cx="${groupCenterX}" cy="${chartBottom + 26}" r="2" fill="var(--indigo)" />` : ''}
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="6-month income and expense comparison chart" style="width:100%; height:auto; overflow:visible;">
      <!-- Grid lines -->
      <line x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" stroke="var(--border-soft)" stroke-width="1" />
      <line x1="0" y1="${chartTop + availHeight / 2}" x2="${width}" y2="${chartTop + availHeight / 2}" stroke="var(--border-soft)" stroke-dasharray="3 3" stroke-width="1" />
      <line x1="0" y1="${chartTop}" x2="${width}" y2="${chartTop}" stroke="var(--border-soft)" stroke-dasharray="3 3" stroke-width="1" />
      ${barsSvg}
    </svg>
  `;
}

// -------------------------------------------------------------
// 2. DONUT CHART (CATEGORY SPENDING DISTRIBUTION)
// -------------------------------------------------------------
export function renderDonutChartSVG(
  transactions: Transaction[],
  categories: Category[],
  ym: YearMonth,
  currency: string
): { svg: string; legendHtml: string } {
  const monthExpenses = transactions.filter(t => isDateInYearMonth(t.date, ym) && t.type === 'expense');
  const catTotals: Record<string, number> = {};
  for (const t of monthExpenses) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  }

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const totalExpense = sortedCats.reduce((a, b) => a + b[1], 0);

  if (totalExpense === 0 || sortedCats.length === 0) {
    return {
      svg: `
        <svg viewBox="0 0 200 200" class="donut-svg" role="img" aria-label="No expenses recorded this month">
          <circle cx="100" cy="100" r="70" fill="none" stroke="var(--border-soft)" stroke-width="20" />
          <text x="100" y="105" text-anchor="middle" font-size="12" fill="var(--text-muted)">No expenses</text>
        </svg>
      `,
      legendHtml: '<div class="empty-state text-sm" style="padding:16px;">No expenses for this month.</div>',
    };
  }

  const cx = 100;
  const cy = 100;
  const radius = 70;
  const strokeWidth = 24;
  let cumulativeAngle = -Math.PI / 2; // start from top (12 o'clock)

  const paths: string[] = [];
  const legendItems: string[] = [];

  for (const [catId, amount] of sortedCats) {
    const cat = categories.find(c => c.id === catId) || { name: catId, emoji: '📦', color: '#8395A7' };
    const fraction = amount / totalExpense;
    const angle = fraction * 2 * Math.PI;
    const pct = Math.round(fraction * 100);

    // Calculate arc start and end
    const startX = cx + radius * Math.cos(cumulativeAngle);
    const startY = cy + radius * Math.sin(cumulativeAngle);
    const endAngle = cumulativeAngle + angle;
    const endX = cx + radius * Math.cos(endAngle);
    const endY = cy + radius * Math.sin(endAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    // SVG arc path
    let d = '';
    if (fraction >= 0.9999) {
      // Full circle workaround for SVG arc
      d = `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 0 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 0 ${cx} ${cy - radius}`;
    } else {
      d = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
    }

    paths.push(`
      <path d="${d}" fill="none" stroke="${cat.color}" stroke-width="${strokeWidth}" stroke-linecap="butt" class="donut-slice" tabindex="0" role="graphics-symbol" aria-label="${cat.name}: ${pct}% (${formatMoney(amount, currency)})">
        <title>${cat.emoji} ${cat.name}: ${formatMoney(amount, currency)} (${pct}%)</title>
      </path>
    `);

    legendItems.push(`
      <div class="donut-legend-item" tabindex="0" style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-soft); font-size:13px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${cat.color};"></span>
          <span>${cat.emoji} ${cat.name}</span>
        </div>
        <div style="font-weight:600; color:var(--text-primary);">
          <span>${formatMoneyCompact(amount, currency)}</span>
          <span style="font-size:11px; color:var(--text-muted); margin-left:4px;">(${pct}%)</span>
        </div>
      </div>
    `);

    cumulativeAngle += angle;
  }

  const svg = `
    <svg viewBox="0 0 200 200" class="donut-svg" role="img" aria-label="Spending breakdown by category. Total: ${formatMoney(totalExpense, currency)}" style="width:180px; height:180px;">
      ${paths.join('')}
      <!-- Center text -->
      <text x="100" y="93" text-anchor="middle" font-size="10" text-transform="uppercase" fill="var(--text-muted)" letter-spacing="0.5">TOTAL SPENT</text>
      <text x="100" y="112" text-anchor="middle" font-family="var(--font-body)" font-size="16" font-weight="700" fill="var(--text-primary)">
        ${formatMoneyCompact(totalExpense, currency)}
      </text>
    </svg>
  `;

  return {
    svg,
    legendHtml: `<div class="donut-legend" style="max-height:220px; overflow-y:auto;">${legendItems.join('')}</div>`,
  };
}

// -------------------------------------------------------------
// 3. BALANCE / CASH FLOW TREND LINE/AREA CHART
// -------------------------------------------------------------
export function renderTrendAreaChartSVG(
  transactions: Transaction[],
  ym: YearMonth,
  currency: string
): string {
  // Aggregate daily net for each day in the month
  const daysInMonth = new Date(ym.year, ym.month + 1, 0).getDate();
  const dailyNet: number[] = new Array(daysInMonth).fill(0);

  const monthTxns = transactions.filter(t => isDateInYearMonth(t.date, ym));
  for (const t of monthTxns) {
    const day = parseInt(t.date.split('-')[2], 10);
    if (day >= 1 && day <= daysInMonth) {
      dailyNet[day - 1] += (t.type === 'income' ? t.amount : -t.amount);
    }
  }

  // Cumulative trend curve across days
  let running = 0;
  const points = dailyNet.map((net, i) => {
    running += net;
    return { day: i + 1, value: running };
  });

  const width = 600;
  const height = 160;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const minVal = Math.min(0, ...points.map(p => p.value));
  const maxVal = Math.max(1, ...points.map(p => p.value));
  const valRange = maxVal - minVal || 1;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const coords = points.map(p => {
    const x = padLeft + ((p.day - 1) / (daysInMonth - 1 || 1)) * chartW;
    const y = padTop + chartH - ((p.value - minVal) / valRange) * chartH;
    return { x, y, day: p.day, val: p.value };
  });

  if (coords.length < 2) return '';

  const pathD = `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map(c => `L ${c.x} ${c.y}`).join(' ');
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padTop + chartH} L ${coords[0].x} ${padTop + chartH} Z`;
  const zeroY = padTop + chartH - ((0 - minVal) / valRange) * chartH;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Month cumulative cash flow trend" style="width:100%; height:auto;">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--indigo)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--indigo)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <!-- Zero reference line -->
      <line x1="${padLeft}" y1="${zeroY}" x2="${width - padRight}" y2="${zeroY}" stroke="var(--border-medium)" stroke-dasharray="3 3" />
      <!-- Area fill -->
      <path d="${areaD}" fill="url(#areaGradient)" />
      <!-- Stroke line -->
      <path d="${pathD}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Sample dots -->
      ${coords.filter((_, i) => i === 0 || i === Math.floor(coords.length / 2) || i === coords.length - 1).map(c => `
        <circle cx="${c.x}" cy="${c.y}" r="4" fill="var(--indigo)" stroke="var(--bg-surface)" stroke-width="2" tabindex="0" role="graphics-symbol" aria-label="Day ${c.day}: ${formatMoney(c.val, currency)}">
          <title>Day ${c.day}: ${formatMoney(c.val, currency)}</title>
        </circle>
      `).join('')}
      <!-- Day labels -->
      <text x="${padLeft}" y="${height - 8}" font-size="11" fill="var(--text-muted)">Day 1</text>
      <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="11" fill="var(--text-muted)">Day ${Math.round(daysInMonth / 2)}</text>
      <text x="${width - padRight}" y="${height - 8}" text-anchor="end" font-size="11" fill="var(--text-muted)">Day ${daysInMonth}</text>
    </svg>
  `;
}
