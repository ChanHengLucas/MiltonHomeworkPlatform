import { test, expect } from '@playwright/test';

test.describe('Support hub flow', () => {
  test('create request, claim as Student B, comment as helper, self-claim blocked', async ({
    page,
    request: apiRequest,
  }) => {
    // Create assignment first for linking
    await page.goto('/assignments');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.fill('input[placeholder="Assignment title"]', 'Support test assignment');
    await page.fill('input[placeholder="e.g. Math 101"]', 'Math');
    await page.fill('input[type="number"][placeholder="e.g. 30"]', '30');
    await page.click('button:has-text("Save Assignment")');
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
    await expect(page.locator('.section-title')).toContainText('Need help?');
    await expect(page.locator('p')).toContainText('I need help with this assignment.');

    // Switch to Student B and claim
    await page.selectOption('.dev-identity-select', 'student-b');
    await page.fill('input[placeholder="Your name"]', 'Test Student');
    await page.click('button:has-text("Claim")');

    // Verify claimed by Student B (display name Test Student)
    await expect(page.locator('text=Claimed by')).toBeVisible();
    await expect(page.locator('text=Test Student')).toBeVisible();

    // Add comment as Student B - verify helper label (no role picker; server derives)
    await page.fill('textarea[placeholder*="message"]', 'I can help with this!');
    await page.click('button:has-text("Post")');
    await expect(page.locator('.comment-item')).toContainText('Helper');

    // Student B (helper, not requester) should NOT see close button
    await expect(page.locator('button:has-text("Close request")')).not.toBeVisible();

    // Switch back to Student A - claim button disabled, self-claim blocked; requester CAN close
    await page.selectOption('.dev-identity-select', 'student-a');
    await expect(page.locator('text=You can\'t claim your own request')).toBeVisible();
    await expect(page.locator('button:has-text("Claim")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Close request")')).toBeVisible();
  });
});
