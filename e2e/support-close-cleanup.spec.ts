import { test, expect } from '@playwright/test';

test.describe('Close request + cleanup (dev)', () => {
  test('close request, disappears from list, cleanup deletes from DB', async ({
    page,
    request: apiRequest,
  }) => {
    // Create a request as Student A
    await page.goto('/support');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder*="summary"]', 'Cleanup test request');
    await page.fill('textarea[placeholder*="detail"]', 'For cleanup test.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await expect(page.locator('.request-card-title:has-text("Cleanup test request")')).toBeVisible();
    await page.click('.request-card:has-text("Cleanup test request")');

    const url = page.url();
    const idMatch = url.match(/\/support\/([a-f0-9-]+)/);
    const requestId = idMatch?.[1];
    expect(requestId).toBeTruthy();

    // Close the request
    await page.click('button:has-text("Close request")');

    // Go back to list - should not appear (show closed unchecked by default)
    await page.goto('/support');
    await expect(page.locator('.request-card-title:has-text("Cleanup test request")')).not.toBeVisible();

    // Enable show closed - should appear
    await page.check('input[type="checkbox"]');
    await expect(page.locator('.request-card-title:has-text("Cleanup test request")')).toBeVisible();

    // Trigger dev cleanup (days=0 deletes all closed)
    const cleanupRes = await apiRequest.post('http://localhost:4000/api/admin/cleanup-closed?days=0');
    expect(cleanupRes.ok()).toBeTruthy();

    // Refresh - even with show closed, request should be gone
    await page.reload();
    await expect(page.locator('.request-card-title:has-text("Cleanup test request")')).not.toBeVisible();
  });
});
