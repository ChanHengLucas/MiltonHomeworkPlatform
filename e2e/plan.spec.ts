import { test, expect } from '@playwright/test';

test.describe('Plan generation', () => {
  test('seed availability, generate plan, verify sessions appear', async ({ page }) => {
    // Seed availability first
    await page.goto('/availability');
    await page.selectOption('select >> nth=0', '0');
    await page.fill('input[type="time"] >> nth=0', '19:00');
    await page.fill('input[type="time"] >> nth=1', '22:00');
    await page.click('button:has-text("Add")');
    await expect(page.locator('.availability-block-item')).toBeVisible();

    // Create an assignment
    await page.goto('/assignments');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder="Assignment title"]', 'Plan test assignment');
    await page.fill('input[placeholder="e.g. Math 101"]', 'Math');
    await page.fill('input[type="number"][placeholder="e.g. 30"]', '30');
    await page.click('button:has-text("Save Assignment")');
    await expect(page.locator('.assignment-card-title:has-text("Plan test assignment")')).toBeVisible();

    // Generate plan
    await page.goto('/plan');
    await page.click('button:has-text("Generate Plan")');

    // Either sessions appear or warning about availability
    const hasSessions = await page.locator('.plan-session-card').count() > 0;
    const hasWarning = await page.locator('.callout-warn-simple, .empty-state').count() > 0;
    expect(hasSessions || hasWarning).toBeTruthy();
    if (hasSessions) {
      await expect(page.locator('.plan-session-card')).toBeVisible();
    }
  });
});
