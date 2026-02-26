import { test, expect } from '@playwright/test';

function rowFor(buttonText: string) {
  return `.qa-test-row:has(button:has-text("${buttonText}"))`;
}

test.describe('QA page (dev-only)', () => {
  test('seed demo data, run claim/comment/self-claim/insights flows, verify PASS', async ({
    page,
  }) => {
    await page.goto('/qa');

    // Seed demo data
    await page.click('button:has-text("Seed Demo Data")');
    await expect(page.locator('.qa-pass:has-text("PASS")').first()).toBeVisible({ timeout: 15000 });

    // Claim as Student B
    await page.click('button:has-text("Claim as Student B")');
    await expect(page.locator(`${rowFor('Claim as Student B')} .qa-pass`)).toBeVisible({ timeout: 10000 });

    // Comment as Student B (Helper)
    await page.click('button:has-text("Comment as Student B (Helper)")');
    await expect(page.locator(`${rowFor('Comment as Student B (Helper)')} .qa-pass`)).toBeVisible({ timeout: 10000 });

    // Self-claim blocked (Student A)
    await page.click('button:has-text("Self-claim blocked (Student A)")');
    await expect(page.locator(`${rowFor('Self-claim blocked (Student A)')} .qa-pass`)).toBeVisible({ timeout: 10000 });

    // Teacher Insights
    await page.click('button:has-text("Teacher Insights")');
    await expect(page.locator(`${rowFor('Teacher Insights')} .qa-pass`)).toBeVisible({ timeout: 10000 });
  });
});
