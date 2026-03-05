import { test, expect } from '@playwright/test';
import { setDevIdentity } from './devIdentity';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

test.describe('Plan generation', () => {
  test('avoid-late-night preference affects generated plan', async ({ page, request }) => {
    // Reset test data to keep this scenario deterministic.
    const assignmentsRes = await request.get(`${API_BASE}/api/assignments`);
    const assignments = await assignmentsRes.json();
    for (const assignment of assignments) {
      await request.delete(`${API_BASE}/api/assignments/${assignment.id}`);
    }
    const availabilityRes = await request.get(`${API_BASE}/api/availability`);
    const availability = await availabilityRes.json();
    for (const block of availability) {
      await request.delete(`${API_BASE}/api/availability/${block.id}`);
    }

    // Add a late-night availability block only (Mon 22:30 -> 23:30).
    await request.post(`${API_BASE}/api/availability`, {
      data: { startMin: 22 * 60 + 30, endMin: 23 * 60 + 30 },
      headers: { 'content-type': 'application/json' },
    });

    await request.post(`${API_BASE}/api/assignments`, {
      headers: { 'content-type': 'application/json' },
      data: {
        course: 'Math',
        title: 'Late night preference test',
        dueAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
        estMinutes: 60,
        priority: 3,
        type: 'homework',
      },
    });

    await setDevIdentity(page, 'student-a');
    // Save planner preferences used by plan generation.
    await page.goto('/settings');
    await page.fill('input[type="time"] >> nth=0', '22:00');
    await page.fill('input[type="time"] >> nth=1', '23:30');
    await page.fill('input[type="number"] >> nth=0', '30');
    await page.fill('input[type="number"] >> nth=1', '0');
    const avoidLateNight = page.locator('label.toggle-row input[type="checkbox"]');
    await avoidLateNight.check();
    await page.click('button:has-text("Save preferences")');
    await expect(page.locator('text=Saved at')).toBeVisible();

    // Generate plan and verify late-night slots (after 11pm) are not used.
    await page.goto('/plan');
    await page.click('button:has-text("Generate Plan")');
    await page.waitForSelector('.plan-session-card, .callout-warn-simple, .empty-state, .ui-callout', {
      timeout: 10000,
    });

    await expect(page.locator('.plan-session-meta').first()).toContainText('22:30–23:00');
    await expect(page.locator('.plan-session-meta')).not.toContainText('23:00–23:30');
    await expect(page.locator('.callout-warn-simple')).toContainText('Insufficient time');
  });
});
