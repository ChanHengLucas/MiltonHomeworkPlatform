import { test, expect } from '@playwright/test';
import { setDevIdentity } from './devIdentity';

test.describe('Support hub flow', () => {
  test('create request, claim as Student B, comment as helper, self-claim blocked', async ({
    page,
    request: apiRequest,
  }) => {
    // Create assignment first for linking
    await setDevIdentity(page, 'student-a');
    await page.goto('/assignments');
    await page.fill('input[placeholder="Assignment title"]', 'Support test assignment');
    await page.fill('input[placeholder="e.g. Math 101"]', 'Math');
    await page.fill('input[type="number"][placeholder="e.g. 30"]', '30');
    const personalCard = page.locator('.ui-card').filter({ hasText: 'Personal assignment details' });
    await personalCard.getByRole('button', { name: 'Add assignment' }).click();
    await page.waitForSelector('.assignment-card-title:has-text("Support test assignment")');
    const needHelpBtn = page.locator('.assignment-card:has-text("Support test assignment") button:has-text("Need help")');
    await needHelpBtn.click();

    // Should navigate to support with prefilled form
    await expect(page).toHaveURL(/\/support/);
    await expect(page.locator('input[placeholder*="summary"]')).toHaveValue(/Help with/);
    await page.fill('input[placeholder*="summary"]', 'Need help?');
    await page.fill('textarea[placeholder*="detail"]', 'I need help with this assignment.');
    await page.fill('input[placeholder*="Math"]', 'Math');
    await page.click('button:has-text("Create Request")');

    // Verify appears in list
    await expect(page.locator('.request-card-title:has-text("Need help?")')).toBeVisible();
    await page.click('.request-card:has-text("Need help?")');

    // Detail page - description visible
    await expect(page).toHaveURL(/\/support\/[a-f0-9-]+/);
    await expect(page.getByRole('heading', { level: 2, name: 'Need help?' })).toBeVisible();
    await expect(page.getByText('I need help with this assignment.')).toBeVisible();
    await page.getByPlaceholder('https://...').fill('https://example.com/support-notes');
    await page.getByPlaceholder('Context for this attachment').fill('Reference worksheet');
    await page.click('button:has-text("Add link")');
    await expect(page.getByRole('link', { name: 'Open link' }).first()).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'support-proof.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('support attachment'),
    });
    await page.click('button:has-text("Upload file")');
    await expect(page.getByText('support-proof.txt').first()).toBeVisible();

    // Switch to Student B and claim
    await setDevIdentity(page, 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Jane Doe');
    await page.click('button:has-text("Claim request")');

    // Verify claimed by Student B (display name Jane Doe)
    await expect(page.getByText('Claimed by: Jane Doe').first()).toBeVisible();

    // Add comment as Student B - verify helper label (no role picker; server derives)
    await page.fill('textarea[placeholder*="message"]', 'I can help with this!');
    await page.click('button:has-text("Post")');
    await expect(
      page.locator('.comment-item').filter({ hasText: 'I can help with this!' })
    ).toContainText('Helper');

    // Student B (helper, not requester) should NOT see close button
    await expect(page.locator('button:has-text("Close request")')).not.toBeVisible();

    // Switch back to Student A - requester can close and cannot claim while request is claimed
    await setDevIdentity(page, 'student-a');
    await expect(page.locator('button:has-text("Claim request")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Close request")')).toBeVisible();
  });
});
