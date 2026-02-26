import { test, expect } from '@playwright/test';

test.describe('Insights + Teacher gating', () => {
  test('student hides teacher nav, teacher can access teacher pages and insights', async ({
    page,
  }) => {
    await page.goto('/assignments');
    await page.selectOption('.dev-identity-select', 'student-a');
    await expect(page.locator('.nav-link:has-text("Teacher")')).not.toBeVisible();
    await expect(page.locator('.nav-link:has-text("Insights")')).not.toBeVisible();

    await page.goto('/teacher');
    await expect(page.locator('h1')).toContainText('Teacher dashboard only');

    // Student visits /insights -> sees "Teacher dashboard only" page
    await page.goto('/insights');
    await expect(page.locator('h1')).toContainText('Teacher dashboard only');
    await expect(page.locator('text=Back to Support Hub')).toBeVisible();

    // Teacher can see teacher navigation and insights
    await page.selectOption('.dev-identity-select', 'teacher');
    await expect(page.locator('.nav-link:has-text("Teacher")')).toBeVisible();
    await expect(page.locator('.nav-link:has-text("Insights")')).toBeVisible();

    // Teacher visits insights -> sees activity overview
    await page.goto('/insights');
    await expect(page.locator('h1')).toContainText(/Support Hub activity overview/);

    // Verify aggregated stats (counts, no full request list)
    await expect(page.locator('text=Total open')).toBeVisible();
    await expect(page.locator('text=Total claimed')).toBeVisible();
    await expect(page.locator('text=Total closed')).toBeVisible();

    // If there's a summary table, urgency should be full words (Medium not med)
    const urgencyCells = page.locator('table.insights-table td:nth-child(2)');
    const count = await urgencyCells.count();
    for (let i = 0; i < count; i++) {
      const text = await urgencyCells.nth(i).textContent();
      expect(text).not.toBe('med');
      expect(text).not.toBe('low');
      expect(text).not.toBe('high');
    }
  });
});
