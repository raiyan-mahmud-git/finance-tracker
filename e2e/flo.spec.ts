import { test, expect } from '@playwright/test';

test.describe('Flo Personal Finance Tracker E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Journey 1: Add, Edit, and Delete a transaction with Undo toast', async ({ page }) => {
    await page.click('button:has-text("+ Add (N)")');
    await expect(page.locator('#dlg-transaction')).toBeVisible();

    await page.fill('#txn-amount', '42.50');
    await page.fill('#txn-desc', 'Organic Grocery Market');
    await page.selectOption('#txn-category', 'groceries');
    await page.click('#txn-submit-btn');

    await expect(page.locator('#dlg-transaction')).not.toBeVisible();

    await expect(page.locator('#dashboard-net-balance')).toBeVisible();

    await page.click('button:has-text("Transactions")');
    await expect(page.locator('text=Organic Grocery Market')).toBeVisible();

    await page.click('button[title="Edit"]');
    await expect(page.locator('#dlg-transaction')).toBeVisible();
    await page.fill('#txn-amount', '55.00');
    await page.click('#txn-submit-btn');
    await expect(page.locator('#dlg-transaction')).not.toBeVisible();

    await page.click('button[title="Delete"]');
    await expect(page.locator('.toast')).toContainText('Deleted "Organic Grocery Market"');

    await page.click('button:has-text("UNDO")');
    await expect(page.locator('text=Organic Grocery Market')).toBeVisible();
  });

  test('Journey 2: Budget over-limit warning and rollover', async ({ page }) => {
    await page.click('button:has-text("Budgets & Recurring")');

    await page.click('button:has-text("+ New Budget")');
    await page.selectOption('#budget-category', 'food');
    await page.fill('#budget-limit', '100');
    await page.click('#form-budget button[type="submit"]');

    await page.click('button:has-text("+ Add (N)")');
    await page.fill('#txn-amount', '135.00');
    await page.fill('#txn-desc', 'Celebratory Dinner');
    await page.selectOption('#txn-category', 'food');
    await page.click('#txn-submit-btn');

    await page.click('button:has-text("Budgets & Recurring")');
    await expect(page.locator('text=OVER BUDGET')).toBeVisible();
  });

  test('Journey 3: Month navigation across the 31st', async ({ page }) => {
    const label = page.locator('#current-month-label');
    await expect(label).toBeVisible();
    const initialMonth = await label.textContent();

    await page.click('button[aria-label="Next month"]');
    const nextMonth = await label.textContent();
    expect(nextMonth).not.toBe(initialMonth);

    await page.click('button[aria-label="Previous month"]');
    const returnedMonth = await label.textContent();
    expect(returnedMonth).toBe(initialMonth);
  });

  test('Journey 4: Dark mode toggle preserves selection', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.click('button[aria-label="Toggle dark or light theme"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('Journey 5: Load sample data and check charts & offline reload', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    await page.click('button:has-text("Load Sample Data")');

    await expect(page.locator('.toast')).toContainText('Sample portfolio data loaded');

    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('svg[aria-label*="6-month"]')).toBeVisible();
    await expect(page.locator('svg.donut-svg')).toBeVisible();

    await page.reload();
    await expect(page.locator('#dashboard-net-balance')).toBeVisible();
  });
});
