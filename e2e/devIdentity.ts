import type { Page } from '@playwright/test';

type DevIdentityPreset = 'student-a' | 'student-b' | 'teacher' | 'student-c';

const PRESETS: Record<DevIdentityPreset, { email: string; name: string }> = {
  'student-a': { email: 'lucas_chan26@milton.edu', name: 'Lucas Chan' },
  'student-b': { email: 'jane_doe27@milton.edu', name: 'Jane Doe' },
  teacher: { email: 'john_smith@milton.edu', name: 'John Smith' },
  'student-c': { email: 'alex_rivera28@milton.edu', name: 'Alex Rivera' },
};

export async function setDevIdentity(page: Page, preset: DevIdentityPreset): Promise<void> {
  const identity = PRESETS[preset];
  if (!page.url().startsWith('http')) {
    await page.goto('/login');
  }
  await page.evaluate(([email, name]) => {
    localStorage.setItem('planner_school_email', email);
    localStorage.setItem('planner_display_name', name);
  }, [identity.email, identity.name] as const);
  await page.reload();
}
