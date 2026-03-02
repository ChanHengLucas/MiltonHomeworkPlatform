import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

const teacherHeaders = {
  'content-type': 'application/json',
  'x-user-email': 'hales@milton.edu',
  'x-user-name': 'Mr. Hales',
};

test.describe('Courses and announcements', () => {
  test('student joins by code and sees teacher assignment + announcements', async ({ page, request }) => {
    const suffix = Date.now();
    const courseName = `Biology ${suffix}`;
    const assignmentTitle = `Join-code assignment ${suffix}`;
    const announcementTitle = `Announcement ${suffix}`;
    const announcementBody = `Welcome to class ${suffix}`;

    const createCourseRes = await request.post(`${API_BASE}/api/teacher/courses`, {
      headers: teacherHeaders,
      data: { name: courseName },
    });
    expect(createCourseRes.ok()).toBeTruthy();
    const course = await createCourseRes.json();
    expect(course.courseCode).toBeTruthy();

    const createAssignmentRes = await request.post(`${API_BASE}/api/teacher/assignments`, {
      headers: teacherHeaders,
      data: {
        courseId: course.id,
        title: assignmentTitle,
        dueAtMs: Date.now() + 3 * 24 * 60 * 60 * 1000,
        estMinutes: 35,
        type: 'homework',
      },
    });
    expect(createAssignmentRes.ok()).toBeTruthy();

    const createAnnouncementRes = await request.post(`${API_BASE}/api/teacher/courses/${course.id}/announcements`, {
      headers: teacherHeaders,
      data: {
        title: announcementTitle,
        body: announcementBody,
      },
    });
    expect(createAnnouncementRes.ok()).toBeTruthy();

    await page.goto('/courses');
    await page.selectOption('.dev-identity-select', 'student-a');

    await page.getByPlaceholder('Enter code (e.g. A1B2C3)').fill(course.courseCode);
    await page.getByRole('button', { name: 'Join course' }).click();

    await expect(page.locator('.course-list-item').filter({ hasText: courseName })).toBeVisible();
    await expect(page.getByText(announcementTitle)).toBeVisible();
    await expect(page.getByText(announcementBody)).toBeVisible();
    await expect(page.getByText(assignmentTitle)).toBeVisible();

    await page.goto('/assignments');
    await expect(page.locator('.assignment-card-title').filter({ hasText: assignmentTitle })).toBeVisible();
  });

  test('assignment notification appears and feedback aggregates for teacher', async ({ page, request }) => {
    const suffix = Date.now();
    const courseName = `History ${suffix}`;
    const assignmentTitle = `Essay draft ${suffix}`;
    const feedbackComment = `Helpful pacing ${suffix}`;

    const createCourseRes = await request.post(`${API_BASE}/api/teacher/courses`, {
      headers: teacherHeaders,
      data: { name: courseName },
    });
    expect(createCourseRes.ok()).toBeTruthy();
    const course = await createCourseRes.json();

    await page.goto('/courses');
    await page.selectOption('.dev-identity-select', 'student-a');
    await page.getByPlaceholder('Enter code (e.g. A1B2C3)').fill(course.courseCode);
    await page.getByRole('button', { name: 'Join course' }).click();
    await expect(page.locator('.course-list-item').filter({ hasText: courseName })).toBeVisible();

    const createAssignmentRes = await request.post(`${API_BASE}/api/teacher/assignments`, {
      headers: teacherHeaders,
      data: {
        courseId: course.id,
        title: assignmentTitle,
        dueAtMs: Date.now() + 2 * 24 * 60 * 60 * 1000,
        estMinutes: 40,
        type: 'homework',
      },
    });
    expect(createAssignmentRes.ok()).toBeTruthy();

    await page.goto('/notifications');
    await expect(page.getByText(assignmentTitle)).toBeVisible();

    await page.goto('/courses');
    await page.locator('.course-list-item').filter({ hasText: courseName }).first().click();
    await page.selectOption('select.ui-select:not(.dev-identity-select)', '4');
    await page
      .getByPlaceholder('Share what worked and what could improve')
      .fill(feedbackComment);
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page.getByText('Last submitted')).toBeVisible();

    await page.selectOption('.dev-identity-select', 'teacher');
    await page.reload();
    await page.goto('/courses');
    await page.locator('.course-list-item').filter({ hasText: courseName }).first().click();
    await expect(page.getByText('Average rating:')).toBeVisible();
    await expect(page.getByText(feedbackComment)).toBeVisible();
  });
});
