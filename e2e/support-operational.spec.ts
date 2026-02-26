import { test, expect } from '@playwright/test';

test.describe('Support hub operational', () => {
  test('claimed request not visible to unrelated student', async ({ page }) => {
    // Create and claim as Student A and B
    await page.goto('/support');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder*="summary"]', 'Visibility test request');
    await page.fill('textarea[placeholder*="detail"]', 'For visibility test.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).toBeVisible();
    await page.click('.request-card:has-text("Visibility test request")');

    // Student B claims
    await page.selectOption('.dev-identity-select', 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Helper');
    await page.click('button:has-text("Claim")');

    // Student B sees the request (they're claimer)
    await expect(page.locator('text=Claimed by')).toBeVisible();

    // Go to list - Student B should see it (claimer)
    await page.goto('/support');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).toBeVisible();

    // Use custom identity for Student C (unrelated) - we don't have student-c preset, use custom
    await page.selectOption('.dev-identity-select', 'custom');
    await page.fill('input[placeholder="Email"]', 'other99@milton.edu');
    await page.fill('input[placeholder="Name"]', 'Other Student');

    // Student C should NOT see the claimed request in list
    await page.goto('/support');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).not.toBeVisible();
  });

  test('unclaim works for claimer', async ({ page }) => {
    await page.goto('/support');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder*="summary"]', 'Unclaim test request');
    await page.fill('textarea[placeholder*="detail"]', 'For unclaim test.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await page.click('.request-card:has-text("Unclaim test request")');

    await page.selectOption('.dev-identity-select', 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Helper');
    await page.click('button:has-text("Claim")');

    // Claimer sees Release claim
    await expect(page.locator('button:has-text("Release claim")')).toBeVisible();
    await page.click('button:has-text("Release claim")');

    // Confirm dialog
    await expect(page.locator('.ui-modal')).toContainText('Release claim');
    await page.locator('.ui-modal button.btn-danger').click();

    await expect(page.locator('text=Claimed by')).not.toBeVisible();
    await expect(page.locator('button:has-text("Claim")')).toBeVisible();
  });

  test('unclaim works for requester (Remove helper)', async ({ page }) => {
    await page.goto('/support');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder*="summary"]', 'Remove helper test');
    await page.fill('textarea[placeholder*="detail"]', 'For remove helper.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await page.click('.request-card:has-text("Remove helper test")');

    await page.selectOption('.dev-identity-select', 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Helper');
    await page.click('button:has-text("Claim")');

    // Switch to requester (Student A)
    await page.selectOption('.dev-identity-select', 'student-a');
    await expect(page.locator('button:has-text("Remove helper")')).toBeVisible();
    await page.click('button:has-text("Remove helper")');

    await expect(page.locator('.ui-modal')).toContainText('Release claim');
    await page.locator('.ui-modal button.btn-danger').click();

    await expect(page.locator('text=Claimed by')).not.toBeVisible();
  });
});
