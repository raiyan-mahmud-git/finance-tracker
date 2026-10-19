// js/charts.js
// Accessible, zero-dependency SVG charts (6-month Bar, Donut, Line/Area Balance over time)
// Clean rendering with tooltips and keyboard accessible elements.

import { formatMoney, formatMoneyCompact } from './money.js';

/**
 * Render 6-Month Income vs Expense Bar Chart with real month labels (Bug 2 fix)
 */
export function renderBarChartSvg(containerEl, monthDataList, currencyKey = 'USD') {
  if (!containerEl) return;

  const maxVal = Math.max(...monthDataList.flatMap(d => [d.income, d.expense]), 100);
  const width = containerEl.clientWidth || 600;
  const height = 150;
  const barPairWidth = width / monthDataList.length;
  const barWidth = Math.min(16, (barPairWidth - 16) / 2);
  const chartHeight = 110;

  const svgParts = [
    `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="6-Month Income vs Expenses Bar Chart">`
  ];

  // Base line
  svgParts.push(`<line x1="0" y1="${chartHeight + 10}" x2="${width}" y2="${chartHeight + 10}" stroke="var(--border-soft)" stroke-width="1" />`);

  monthDataList.forEach((d, idx) => {
    const groupX = idx * barPairWidth + (barPairWidth / 2);
    const incHeight = Math.max((d.income / maxVal) * chartHeight, 4);
    const expHeight = Math.max((d.expense / maxVal) * chartHeight, 4);

    const incX = groupX - barWidth - 2;
    const expX = groupX + 2;

    const incY = (chartHeight + 10) - incHeight;
    const expY = (chartHeight + 10) - expHeight;

    const incFmt = formatMoney(d.income, currencyKey);
    const expFmt = formatMoney(d.expense, currencyKey);

    // Income bar
    svgParts.push(`
      <g tabindex="0" role="graphics-symbol" aria-label="${d.label} Income: ${incFmt}">
        <title>${d.label} Income: ${incFmt}</title>
        <rect class="bar-income" x="${incX}" y="${incY}" width="${barWidth}" height="${incHeight}" rx="4" fill="var(--income)">
          <animate attributeName="height" from="0" to="${incHeight}" dur="0.3s" fill="freeze" />
          <animate attributeName="y" from="${chartHeight + 10}" to="${incY}" dur="0.3s" fill="freeze" />
        </rect>
      </g>
    `);

    // Expense bar
    svgParts.push(`
      <g tabindex="0" role="graphics-symbol" aria-label="${d.label} Expense: ${expFmt}">
        <title>${d.label} Expense: ${expFmt}</title>
        <rect class="bar-expense" x="${expX}" y="${expY}" width="${barWidth}" height="${expHeight}" rx="4" fill="var(--expense)">
          <animate attributeName="height" from="0" to="${expHeight}" dur="0.3s" fill="freeze" />
          <animate attributeName="y" from="${chartHeight + 10}" to="${expY}" dur="0.3s" fill="freeze" />
        </rect>
      </g>
    `);

    // Month label
    svgParts.push(`
      <text x="${groupX}" y="${chartHeight + 28}" text-anchor="middle" font-size="11" font-weight="500" fill="var(--text-muted)">
        ${d.label}
      </text>
    `);
  });

  svgParts.push(`</svg>`);
  containerEl.innerHTML = svgParts.join('');
}

/**
 * Render Category Spending Donut Chart with SVG
 */
export function renderDonutChartSvg(containerEl, categorySpendingList, totalExpenseMinor, currencyKey = 'USD') {
  if (!containerEl) return;

  if (!categorySpendingList.length || totalExpenseMinor <= 0) {
    containerEl.innerHTML = `<div class="empty-state" style="padding:24px;">No expense data for chart</div>`;
    return;
  }

  const size = 200;
  const radius = 70;
  const strokeWidth = 24;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;
  const segments = [];

  categorySpendingList.forEach(item => {
    const fraction = item.amount / totalExpenseMinor;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -(currentAngle * circumference);
    currentAngle += fraction;

    const formatted = formatMoney(item.amount, currencyKey);
    const pct = Math.round(fraction * 100);

    segments.push(`
      <circle
        cx="${center}"
        cy="${center}"
        r="${radius}"
        fill="transparent"
        stroke="${item.category.color || 'var(--indigo)'}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
        role="graphics-symbol"
        tabindex="0"
        aria-label="${item.category.name}: ${formatted} (${pct}%)"
      >
        <title>${item.category.name}: ${formatted} (${pct}%)</title>
      </circle>
    `);
  });

  const centerText = formatMoneyCompact(totalExpenseMinor, currencyKey);

  containerEl.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; position:relative;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-svg" role="img" aria-label="Category Spending Donut">
        <g transform="rotate(-90 ${center} ${center})">
          ${segments.join('')}
        </g>
        <text x="${center}" y="${center - 6}" text-anchor="middle" font-size="12" fill="var(--text-muted)">Total Spent</text>
        <text x="${center}" y="${center + 16}" text-anchor="middle" font-size="17" font-weight="700" font-family="var(--font-display)" fill="var(--text-primary)">${centerText}</text>
      </svg>
    </div>
  `;
}

/**
 * Render Balance Over Time Line/Area Chart with SVG
 */
export function renderBalanceTimelineSvg(containerEl, timelineData, currencyKey = 'USD') {
  if (!containerEl) return;

  if (timelineData.length < 2) {
    containerEl.innerHTML = `<div class="empty-state" style="padding:20px;">Need at least 2 transactions to display timeline</div>`;
    return;
  }

  const width = containerEl.clientWidth || 600;
  const height = 130;
  const padding = 20;

  const balances = timelineData.map(d => d.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const range = (maxBal - minBal) || 1;

  const points = timelineData.map((d, i) => {
    const x = padding + (i / (timelineData.length - 1)) * (width - 2 * padding);
    const y = (height - padding) - ((d.balance - minBal) / range) * (height - 2 * padding);
    return { x, y, data: d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  const circles = points.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--indigo)" stroke="var(--bg-surface)" stroke-width="2" role="graphics-symbol" tabindex="0">
      <title>${p.data.date}: ${formatMoney(p.data.balance, currencyKey)}</title>
    </circle>
  `).join('');

  containerEl.innerHTML = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="timeline-svg" role="img" aria-label="Balance Timeline Area Chart">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--indigo)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--indigo)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#areaGradient)" />
      <path d="${pathD}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${circles}
    </svg>
  `;
}
