import { expect, test } from '@playwright/test';

const PLANNER_PREFERENCES_PATH = '/api/settings/planner-preferences';
const UNREAD_NOTIFICATIONS_PATH = '/api/notifications/unread-count';
const STUDENT_ASSIGNMENTS_PATH = '/api/student/assignments';

test.describe('Auth flow', () => {
  test('unauthenticated login does not prefetch protected endpoints', async ({ page }) => {
    const requestedPaths: string[] = [];
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        requestedPaths.push(url.pathname);
      } catch {
        // ignore malformed URLs in test instrumentation
      }
    });

    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('planner_school_email');
      localStorage.removeItem('planner_display_name');
    });
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('DEV MODE (no Google)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toHaveCount(0);
    await page.waitForLoadState('networkidle');

    expect(requestedPaths).not.toContain(PLANNER_PREFERENCES_PATH);
    expect(requestedPaths).not.toContain(UNREAD_NOTIFICATIONS_PATH);
    expect(requestedPaths).not.toContain(STUDENT_ASSIGNMENTS_PATH);
  });

  test('dev identity mode hides Google login and marks identity clearly', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('planner_school_email', 'lucas_chan26@milton.edu');
      localStorage.setItem('planner_display_name', 'Lucas Chan');
    });
    await page.reload();

    await expect(page).toHaveURL(/\/assignments$/);
    await expect(page.getByText('DEV MODE (no Google)')).toBeVisible();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/assignments$/);

    await page.goto('/settings');
    await expect(page.getByText('Dev mode identity (not Google)')).toBeVisible();
  });
});
