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
    await page.click('button:has-text("Claim request")');

    // Student B sees the request (they're claimer)
    await expect(page.getByText(/Claimed by:/).first()).toBeVisible();

    // Go to list - Open filter is default, so claimed request is hidden
    await page.goto('/support');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).not.toBeVisible();
    await page.click('button.filter-chip:has-text("Claimed")');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).toBeVisible();

    // Switch to unrelated Student C via local storage identity
    await page.evaluate(() => {
      localStorage.setItem('planner_school_email', 'other99@milton.edu');
      localStorage.setItem('planner_display_name', 'Other Student');
    });
    await page.reload();

    // Student C should NOT see the claimed request in list
    await page.goto('/support');
    await page.click('button.filter-chip:has-text("Claimed")');
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
    await page.click('button:has-text("Claim request")');

    // Claimer sees Release claim
    const releaseButton = page
      .locator('button:has-text("Release claim"), button:has-text("Release helper"), button:has-text("Remove helper")')
      .first();
    await expect(releaseButton).toBeVisible();
    await releaseButton.click();

    // Confirm dialog
    await expect(page.locator('.ui-modal')).toContainText('Release claim');
    await page.locator('.ui-modal button.btn-danger').click();

    await expect(page.getByText(/Claimed by:/).first()).not.toBeVisible();
    await expect(page.locator('button:has-text("Claim request")')).toBeVisible();
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
    await page.click('button:has-text("Claim request")');

    // Switch to requester (Student A)
    await page.selectOption('.dev-identity-select', 'student-a');
    const requesterRelease = page
      .locator('button:has-text("Remove helper"), button:has-text("Release helper"), button:has-text("Release claim")')
      .first();
    await expect(requesterRelease).toBeVisible();
    await requesterRelease.click();

    await expect(page.locator('.ui-modal')).toContainText('Release claim');
    await page.locator('.ui-modal button.btn-danger').click();

    await expect(page.getByText(/Claimed by:/).first()).not.toBeVisible();
  });
});
