import { test, expect } from '@playwright/test';
import { setDevIdentity } from './devIdentity';

test.describe('Support hub operational', () => {
  test('claimed request not visible to unrelated student', async ({ page }) => {
    // Create and claim as Student A and B
    await setDevIdentity(page, 'student-a');
    await page.goto('/support');
    await page.locator('.form-group:has(label:has-text("Title")) input').first().fill('Visibility test request');
    await page.fill('textarea[placeholder*="detail"]', 'For visibility test.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).toBeVisible();
    await page.click('.request-card:has-text("Visibility test request")');

    // Student B claims
    await setDevIdentity(page, 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Helper');
    await page.click('button:has-text("Claim request")');

    // Student B sees the request (they're claimer)
    await expect(page.getByText(/Claimed by:/).first()).toBeVisible();

    // Go to list - Open filter is default, so claimed request is hidden
    await page.goto('/support');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).not.toBeVisible();
    await page.click('button.filter-chip:has-text("Claimed")');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).toBeVisible();

    // Switch to unrelated Student C.
    await setDevIdentity(page, 'student-c');

    // Student C should NOT see the claimed request in list
    await page.goto('/support');
    await page.click('button.filter-chip:has-text("Claimed")');
    await expect(page.locator('.request-card-title:has-text("Visibility test request")')).not.toBeVisible();
  });

  test('unclaim works for claimer', async ({ page }) => {
    await setDevIdentity(page, 'student-a');
    await page.goto('/support');
    await page.locator('.form-group:has(label:has-text("Title")) input').first().fill('Unclaim test request');
    await page.fill('textarea[placeholder*="detail"]', 'For unclaim test.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await page.click('.request-card:has-text("Unclaim test request")');

    await setDevIdentity(page, 'student-b');
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
    await setDevIdentity(page, 'student-a');
    await page.goto('/support');
    await page.locator('.form-group:has(label:has-text("Title")) input').first().fill('Remove helper test');
    await page.fill('textarea[placeholder*="detail"]', 'For remove helper.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    await page.click('.request-card:has-text("Remove helper test")');

    await setDevIdentity(page, 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Helper');
    await page.click('button:has-text("Claim request")');

    // Switch to requester (Student A)
    await setDevIdentity(page, 'student-a');
    const requesterRelease = page
      .locator('button:has-text("Remove helper"), button:has-text("Release helper"), button:has-text("Release claim")')
      .first();
    await expect(requesterRelease).toBeVisible();
    await requesterRelease.click();

    await expect(page.locator('.ui-modal')).toContainText('Release claim');
    await page.locator('.ui-modal button.btn-danger').click();

    await expect(page.getByText(/Claimed by:/).first()).not.toBeVisible();
  });

  test('teacher-only claim mode blocks student claims', async ({ page, request }) => {
    await setDevIdentity(page, 'student-a');
    await page.goto('/support');
    await page.locator('.form-group:has(label:has-text("Title")) input').first().fill('Teacher-only support request');
    await page.fill('textarea[placeholder*="detail"]', 'Only teachers should be able to claim this.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.selectOption('select:has(option[value="teacher_only"])', 'teacher_only');
    await page.click('button:has-text("Create Request")');

    const card = page.locator('.request-card:has-text("Teacher-only support request")').first();
    await expect(card).toBeVisible();

    // Switch away from requester so restriction messaging is shown instead of own-request messaging.
    await setDevIdentity(page, 'student-b');
    await card.click();
    await expect(page.getByText('restricted to teacher/tutor claims')).toBeVisible();

    const requestUrl = page.url();
    const requestId = requestUrl.split('/').pop() || '';
    expect(requestId).toMatch(/[a-f0-9-]{36}/);

    await expect(page.locator('button:has-text("Claim request")')).not.toBeVisible();

    const blockedClaim = await request.post(`/api/requests/${requestId}/claim`, {
      headers: {
        'content-type': 'application/json',
        'x-user-email': 'test34@milton.edu',
        'x-user-name': 'Test Student',
      },
      data: { claimedBy: 'Test Student' },
    });
    expect(blockedClaim.status()).toBe(403);

    const teacherClaim = await request.post(`/api/requests/${requestId}/claim`, {
      headers: {
        'content-type': 'application/json',
        'x-user-email': 'hales@milton.edu',
        'x-user-name': 'Mr. Hales',
      },
      data: { claimedBy: 'Mr. Hales' },
    });
    expect(teacherClaim.ok()).toBeTruthy();
  });
});
