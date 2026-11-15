/**
 * Dashboard View
 *
 * Clean, production-grade metrics with robust tabular numbers that never wrap or stretch.
 */

import { calculateCumulativeBalance, calculateMonthSummary, calculateInsights } from '../analytics.ts';
import { renderBarChartSVG, renderDonutChartSVG, renderTrendAreaChartSVG } from '../charts.ts';
import { formatYearMonth, isDateInYearMonth } from '../dates.ts';
import { formatMoney } from '../money.ts';
import { escapeHtml } from '../security.ts';
import type { AppState } from '../store.ts';

export function renderDashboardView(state: AppState): string {
  const currency = state.data.settings.currency;
  const ym = state.ui.viewedYearMonth;
  const transactions = state.data.transactions;
  const categories = state.data.categories;

  // True cumulative balance across ALL transactions
  const cumulativeBalance = calculateCumulativeBalance(transactions);
  // Viewed month summary
  const monthSummary = calculateMonthSummary(transactions, ym);
  // Spending insights
  const insights = calculateInsights(transactions, ym);

  // Month transactions for category listing
  const currentMonthTxns = transactions.filter(t => isDateInYearMonth(t.date, ym));
  const expenseTxns = currentMonthTxns.filter(t => t.type === 'expense');

  // Group by category
  const byCat: Record<string, number> = {};
  expenseTxns.forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  });
  const sortedCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  // Donut chart
  const { svg: donutSvg, legendHtml } = renderDonutChartSVG(transactions, categories, ym, currency);
  // 6-month bar chart
  const barChartSvg = renderBarChartSVG(transactions, ym, currency);
  // Cash flow trend area chart
  const trendChartSvg = renderTrendAreaChartSVG(transactions, ym, currency);

  return `
    <div class="dashboard-view animate-fade-in" style="display:flex; flex-direction:column; gap:24px;">
      <!-- Top Cards Row: True Cumulative Balance & Monthly Highlights -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
        <!-- Cumulative Balance Card -->
        <div class="card" style="overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                True Cumulative Balance
              </div>
              <div style="font-size:clamp(24px, 2.8vw, 36px); font-weight:700; color:var(--text-primary); line-height:1.15;" class="money-value" id="dashboard-net-balance">
                ${formatMoney(cumulativeBalance, currency)}
              </div>
            </div>
            <span style="font-size:24px; padding:6px; background:var(--bg-elevated); border-radius:10px; margin-left:8px; flex-shrink:0;">💳</span>
          </div>

          <div style="display:flex; align-items:center; gap:8px; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-soft); font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <span>Viewed month net:</span>
            <span style="font-weight:700; color:${monthSummary.net >= 0 ? 'var(--income)' : 'var(--expense)'};" class="money-value">
              ${monthSummary.net >= 0 ? '+' : ''}${formatMoney(monthSummary.net, currency)}
            </span>
          </div>
        </div>

        <!-- Monthly Income Card -->
        <div class="card" style="overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                Monthly Income (${formatYearMonth(ym)})
              </div>
              <div style="font-size:clamp(22px, 2.6vw, 32px); font-weight:700; color:var(--income); line-height:1.15;" class="money-value">
                +${formatMoney(monthSummary.income, currency)}
              </div>
            </div>
            <span style="font-size:22px; background:var(--income-light); border-radius:10px; padding:6px; margin-left:8px; flex-shrink:0;">💰</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:16px; padding-top:12px; border-top:1px solid var(--border-soft);">
            ↑ ${monthSummary.incomeCount} transaction${monthSummary.incomeCount === 1 ? '' : 's'}
          </div>
        </div>

        <!-- Monthly Expense Card (strictly prevents '-' wrapping onto its own line) -->
        <div class="card" style="overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                Monthly Expense (${formatYearMonth(ym)})
              </div>
              <div style="font-size:clamp(22px, 2.6vw, 32px); font-weight:700; color:var(--expense); line-height:1.15; white-space:nowrap; display:inline-flex; align-items:baseline;" class="money-value">
                -${formatMoney(monthSummary.expense, currency)}
              </div>
            </div>
            <span style="font-size:22px; background:var(--expense-light); border-radius:10px; padding:6px; margin-left:8px; flex-shrink:0;">💸</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:16px; padding-top:12px; border-top:1px solid var(--border-soft);">
            ↓ ${monthSummary.expenseCount} transaction${monthSummary.expenseCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <!-- Financial Insights Card -->
      <div class="card" style="border-left:4px solid ${insights.isOverPace ? 'var(--expense)' : 'var(--indigo)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">💡</span>
            <span style="font-weight:700; font-size:15px; color:var(--text-primary);">
              Month Insights & Pace
            </span>
          </div>
          <span style="font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; background:${insights.isOverPace ? 'var(--expense-light)' : 'var(--indigo-light)'}; color:${insights.isOverPace ? 'var(--expense)' : 'var(--indigo)'};">
            ${insights.isOverPace ? '⚠️ Over Pace' : '✓ On Track'}
          </span>
        </div>

        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; line-height:1.6;">
          ${escapeHtml(insights.paceMessage)}
        </p>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px; padding-top:12px; border-top:1px solid var(--border-soft);">
          <div>
            <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px;">Avg Daily Spend</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-top:2px;" class="money-value">
              ${formatMoney(insights.avgDailySpend, currency)}
            </div>
          </div>
          <div>
            <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px;">Projected Spend</div>
            <div style="font-weight:700; font-size:16px; color:var(--text-primary); margin-top:2px;" class="money-value">
              ${formatMoney(insights.projectedMonthEndSpend, currency)}
            </div>
          </div>
          ${insights.biggestChangeCategory ? `
            <div>
              <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px;">Biggest Change</div>
              <div style="font-weight:700; font-size:14px; color:var(--text-primary); margin-top:2px;" class="money-value">
                ${insights.biggestChangeCategory.categoryId}: ${insights.biggestChangeCategory.diff > 0 ? '+' : ''}${formatMoney(insights.biggestChangeCategory.diff, currency)}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Charts Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:20px;">
        <!-- 6-Month Comparison Bar Chart -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="font-size:15px; font-weight:700; color:var(--text-primary);">
                6-Month Overview
              </h3>
              <p style="font-size:11px; color:var(--text-muted);">
                Anchored to ${formatYearMonth(ym)}
              </p>
            </div>
            <div style="display:flex; gap:12px; font-size:11px; font-weight:600;">
              <span style="display:flex; align-items:center; gap:4px; color:var(--income);">
                <span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:var(--income);"></span> Income
              </span>
              <span style="display:flex; align-items:center; gap:4px; color:var(--expense);">
                <span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:var(--expense);"></span> Expense
              </span>
            </div>
          </div>
          ${barChartSvg}
        </div>

        <!-- Donut Breakdown Chart -->
        <div class="card">
          <h3 style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:16px;">
            Expenses by Category
          </h3>
          <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap; justify-content:center;">
            <div>${donutSvg}</div>
            <div style="flex:1; min-width:180px;">${legendHtml}</div>
          </div>
        </div>
      </div>

      <!-- Cash Flow Trend Area Chart -->
      <div class="card">
        <h3 style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
          Monthly Cash Flow Trend
        </h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
          Cumulative net trajectory across the days of ${formatYearMonth(ym)}
        </p>
        ${trendChartSvg}
      </div>

      <!-- Top Categories -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:15px; font-weight:700; color:var(--text-primary);">
            Top Spending Categories (${formatYearMonth(ym)})
          </h3>
          <button type="button" class="btn btn-sm" onclick="window.floApp.switchView('transactions')">
            View All Activity →
          </button>
        </div>

        ${sortedCategories.length > 0 ? `
          <div style="display:flex; flex-direction:column;">
            ${sortedCategories.slice(0, 5).map(([catId, amt]) => {
              const cat = categories.find(c => c.id === catId) || { name: catId, emoji: '📦', color: '#8395A7' };
              const pct = monthSummary.expense > 0 ? Math.round((amt / monthSummary.expense) * 100) : 0;
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border-soft);">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:20px; width:36px; height:36px; border-radius:10px; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center;">
                      ${cat.emoji}
                    </span>
                    <div>
                      <div style="font-weight:600; font-size:14px; color:var(--text-primary);">${escapeHtml(cat.name)}</div>
                      <div style="font-size:11px; color:var(--text-muted);">${pct}% of monthly spending</div>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:700; font-size:15px; color:var(--text-primary);" class="money-value">
                      ${formatMoney(amt, currency)}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="empty-state" style="padding:32px 16px; text-align:center;">
            <div style="font-size:36px; margin-bottom:8px;">🍃</div>
            <p style="font-weight:600; color:var(--text-primary);">No expenses in this month</p>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">Add a transaction or load sample data.</p>
            <div style="display:flex; gap:8px; justify-content:center;">
              <button type="button" class="btn btn-primary btn-sm" onclick="window.floApp.openAddTransactionModal()">+ Add Transaction</button>
              <button type="button" class="btn btn-sm" onclick="window.floApp.loadSampleData()">Load Sample Data</button>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
