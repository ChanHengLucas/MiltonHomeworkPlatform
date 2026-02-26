import { test, expect } from '@playwright/test';

test.describe('Insights + Teacher gating', () => {
  test('Student A -> Teacher toggle disabled; Teacher -> allowed; Insights teacher-only', async ({
    page,
  }) => {
    await page.goto('/settings');

    // Student A - Teacher mode toggle disabled
    await page.selectOption('.dev-identity-select', 'student-a');
    const teacherToggle = page.locator('label:has-text("Teacher Mode")');
    await expect(teacherToggle).toHaveClass(/toggle-disabled/);
    await expect(teacherToggle.locator('input')).toBeDisabled();

    // Student visits /insights -> sees "Teacher dashboard only" page
    await page.goto('/insights');
    await expect(page.locator('h1')).toContainText('Teacher dashboard only');
    await expect(page.locator('text=Back to Support Hub')).toBeVisible();

    // Teacher - Teacher mode allowed
    await page.selectOption('.dev-identity-select', 'teacher');
    await expect(teacherToggle).not.toHaveClass(/toggle-disabled/);
    await expect(teacherToggle.locator('input')).toBeEnabled();

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
