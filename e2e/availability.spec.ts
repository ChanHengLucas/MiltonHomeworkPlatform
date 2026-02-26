import { test, expect } from '@playwright/test';

test.describe('Availability flow', () => {
  test('add block Mon 19:00–22:00, verify in list under Mon', async ({ page }) => {
    await page.goto('/availability');

    await page.selectOption('select >> nth=0', '0'); // Mon = index 0
    await page.fill('input[type="time"] >> nth=0', '19:00');
    await page.fill('input[type="time"] >> nth=1', '22:00');
    await page.click('button:has-text("Add")');

    await expect(page.locator('.availability-day-group')).toContainText('Mon');
    await expect(page.locator('.availability-block-item')).toContainText(/(19|7):00/);
    await expect(page.locator('.availability-block-item')).toContainText(/(22|10):00/);
  });
});
