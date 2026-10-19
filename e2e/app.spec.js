import { test, expect } from '@playwright/test';

test.describe('Flo E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Add, edit, and delete a transaction with undo toast', async ({ page }) => {
    // 1. Click Add+ FAB
    await page.click('#fabBtn');
    await expect(page.locator('#txnModal')).toHaveClass(/open/);

    // 2. Fill form and save
    await page.fill('#txnAmount', '45.50');
    await page.fill('#txnDesc', 'Supermarket Dinner');
    await page.fill('#txnDate', '2026-04-18');
    await page.click('#txnForm button[type="submit"]');

    // Modal should close
    await expect(page.locator('#txnModal')).not.toHaveClass(/open/);

    // Navigate to Transactions view via desktop sidebar or switchView
    await page.evaluate(() => window.floApp.switchView('transactions'));
    await expect(page.locator('#view-transactions')).toHaveClass(/active/);

    // Transaction should appear
    const txnName = page.locator('.txn-name', { hasText: 'Supermarket Dinner' });
    await expect(txnName).toBeVisible();

    // 3. Edit transaction
    await page.click('.edit-txn-btn');
    await expect(page.locator('#txnModal')).toHaveClass(/open/);
    await page.fill('#txnDesc', 'Supermarket Dinner & Drinks');
    await page.click('#txnForm button[type="submit"]');

    await expect(page.locator('.txn-name', { hasText: 'Supermarket Dinner & Drinks' })).toBeVisible();

    // 4. Delete transaction
    await page.click('.delete-txn-btn');
    await expect(page.locator('#toastContainer')).toHaveClass(/visible/);
    await expect(page.locator('.txn-name', { hasText: 'Supermarket Dinner & Drinks' })).toHaveCount(0);

    // 5. Click Undo
    await page.click('#toastUndoBtn');
    await expect(page.locator('.txn-name', { hasText: 'Supermarket Dinner & Drinks' })).toBeVisible();
  });

  test('Budget over-limit warning and state', async ({ page }) => {
    // Navigate to Budgets
    await page.evaluate(() => window.floApp.switchView('budgets'));
    await expect(page.locator('#view-budgets')).toHaveClass(/active/);

    // Create a Food budget with limit $50
    await page.click('button:has-text("+ New Budget")');
    await page.selectOption('#budgetCategory', 'food');
    await page.fill('#budgetLimit', '50');
    await page.click('#budgetForm button[type="submit"]');

    // Add an expense of $75 in Food to exceed budget in the currently viewed month
    await page.click('#fabBtn');
    await page.fill('#txnAmount', '75.00');
    await page.fill('#txnDesc', 'Big Feast');
    await page.selectOption('#txnCategory', 'food');
    // Date input defaults to getLocalTodayString() which is the current viewed month!
    await page.click('#txnForm button[type="submit"]');

    // Check Budget card shows over-budget state
    await page.evaluate(() => window.floApp.switchView('budgets'));
    await expect(page.locator('text=Over budget')).toBeVisible();
  });

  test('Month navigation across boundary', async ({ page }) => {
    // Initial month check
    const label = page.locator('#currentMonthLabel');
    await expect(label).toBeVisible();

    // Click previous month
    await page.click('#prevMonthBtn');
    // Click next month
    await page.click('#nextMonthBtn');
    await expect(label).toBeVisible();
  });

  test('Dark mode toggle persists and updates data-theme attribute', async ({ page }) => {
    await page.evaluate(() => window.floApp.switchView('settings'));
    await page.selectOption('#themeSettingSelect', 'dark');

    const htmlTheme = await page.getAttribute('html', 'data-theme');
    expect(htmlTheme).toBe('dark');
  });

  test('Load demo data and verify working undo option', async ({ page }) => {
    await page.evaluate(() => window.floApp.switchView('settings'));
    await page.click('button:has-text("Load Demo")');

    // Verify toast appears
    await expect(page.locator('#toastContainer')).toHaveClass(/visible/);
    await expect(page.locator('#toastMessage')).toContainText('Demo data loaded');

    // Check Dashboard populated
    await page.evaluate(() => window.floApp.switchView('dashboard'));
    await expect(page.locator('#categoryRows')).not.toContainText('No expenses');

    // Click Undo on Demo data load
    await page.click('#toastUndoBtn');
    await expect(page.locator('#toastContainer')).not.toHaveClass(/visible/);
  });
});
