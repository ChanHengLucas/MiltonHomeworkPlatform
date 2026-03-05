import type { Page } from '@playwright/test';

type DevIdentityPreset = 'student-a' | 'student-b' | 'teacher' | 'student-c';

const PRESETS: Record<DevIdentityPreset, { email: string; name: string }> = {
  'student-a': { email: 'lucas12@milton.edu', name: 'Lucas Chan' },
  'student-b': { email: 'test34@milton.edu', name: 'Test Student' },
  teacher: { email: 'hales@milton.edu', name: 'Mr. Hales' },
  'student-c': { email: 'other99@milton.edu', name: 'Other Student' },
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
