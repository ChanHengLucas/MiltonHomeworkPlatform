import { test, expect } from '@playwright/test';

test.describe('Assignments flow', () => {
  test('create assignment, verify due date, persist after refresh', async ({ page }) => {
    await page.goto('/assignments');

    // Set Student A via Dev Identity Switcher
    await page.selectOption('.dev-identity-select', 'student-a');
    await expect(page.locator('.dev-identity-current')).toContainText('lucas12@milton.edu');

    // Fill confirm form (skip parse - fill directly)
    const confirmCard = page.locator('.ui-card').filter({ hasText: 'Personal assignment details' });
    await confirmCard.getByPlaceholder('Assignment title').fill('Physics homework');
    await confirmCard.getByPlaceholder('e.g. Math 101').fill('Physics');
    await confirmCard.locator('input[type="datetime-local"]').fill('2026-02-12T23:59');
    await confirmCard.getByPlaceholder('e.g. 30').fill('30');

    await confirmCard.getByRole('button', { name: 'Add assignment' }).click();

    // Verify it appears in list with correct due date (not 1970, not shifted)
    await expect(page.locator('.assignment-card-title:has-text("Physics homework")')).toBeVisible({ timeout: 5000 });
    const meta = page.locator('.assignment-card:has-text("Physics homework") .assignment-card-meta');
    await expect(meta).toContainText('Physics');
    await expect(meta).toContainText('30 min');
    await expect(meta).not.toContainText('1970');
    await expect(meta).not.toContainText('No due date');

    // Refresh and verify persist
    await page.reload();
    await expect(page.locator('.assignment-card-title:has-text("Physics homework")')).toBeVisible({ timeout: 5000 });
  });
});
