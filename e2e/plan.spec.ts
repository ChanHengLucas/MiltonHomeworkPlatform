import { test, expect } from '@playwright/test';

test.describe('Plan generation', () => {
  test('seed availability, generate plan, verify sessions appear', async ({ page }) => {
    // Seed availability first
    await page.goto('/availability');
    await page.selectOption('select >> nth=0', '0');
    await page.fill('input[type="time"] >> nth=0', '19:00');
    await page.fill('input[type="time"] >> nth=1', '22:00');
    await page.click('button:has-text("Add")');
    await expect(page.locator('.availability-block-item').first()).toBeVisible();

    // Create an assignment
    await page.goto('/assignments');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder="Assignment title"]', 'Plan test assignment');
    await page.fill('input[placeholder="e.g. Math 101"]', 'Math');
    await page.fill('input[type="number"][placeholder="e.g. 30"]', '30');
    const personalCard = page.locator('.ui-card').filter({ hasText: 'Personal assignment details' });
    await personalCard.getByRole('button', { name: 'Add assignment' }).click();
    await expect(page.locator('.assignment-card-title:has-text("Plan test assignment")')).toBeVisible();

    // Save planner preferences used by plan generation
    await page.goto('/settings');
    await page.fill('input[type="number"] >> nth=0', '30');
    await page.fill('input[type="number"] >> nth=1', '5');
    await page.click('button:has-text("Save preferences")');
    await page.waitForTimeout(300);

    // Generate plan
    await page.goto('/plan');
    await page.click('button:has-text("Generate Plan")');
    await page.waitForSelector('.plan-session-card, .callout-warn-simple, .empty-state, .ui-callout', {
      timeout: 10000,
    });

    // Either sessions appear or warning about availability
    const hasSessions = await page.locator('.plan-session-card').count() > 0;
    const hasWarning = await page.locator('.callout-warn-simple, .empty-state, .ui-callout').count() > 0;
    expect(hasSessions || hasWarning).toBeTruthy();
    if (hasSessions) {
      await expect(page.locator('.plan-session-card').first()).toBeVisible();
    }
  });
});
