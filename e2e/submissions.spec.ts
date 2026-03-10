import { test, expect } from '@playwright/test';
import { setDevIdentity } from './devIdentity';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

const teacherHeaders = {
  'content-type': 'application/json',
  'x-user-email': 'john_smith@milton.edu',
  'x-user-name': 'John Smith',
};

test.describe('Homework submissions', () => {
  test('student submits assignment and teacher can view submission details', async ({ page, request }) => {
    const suffix = Date.now();
    const courseName = `Geometry ${suffix}`;
    const assignmentTitle = `Submission test ${suffix}`;
    const submissionComment = `Completed all steps for ${suffix}`;
    const submissionLink = `https://example.com/submission-${suffix}`;

    const createCourseRes = await request.post(`${API_BASE}/api/teacher/courses`, {
      headers: teacherHeaders,
      data: { name: courseName },
    });
    expect(createCourseRes.ok()).toBeTruthy();
    const course = await createCourseRes.json();

    const createAssignmentRes = await request.post(`${API_BASE}/api/teacher/assignments`, {
      headers: teacherHeaders,
      data: {
        courseId: course.id,
        title: assignmentTitle,
        description: 'Show your work in a shared document.',
        dueAtMs: Date.now() + 72 * 60 * 60 * 1000,
        estMinutes: 35,
        type: 'homework',
      },
    });
    expect(createAssignmentRes.ok()).toBeTruthy();

    await setDevIdentity(page, 'student-a');
    await page.goto('/courses');
    await page.getByPlaceholder('Enter code (e.g. A1B2C3)').fill(course.courseCode);
    await page.getByRole('button', { name: 'Join course' }).click();
    await expect(page.locator('.course-list-item').filter({ hasText: courseName })).toBeVisible();

    await page.goto('/assignments');
    const assignmentCard = page.locator('.assignment-card').filter({ hasText: assignmentTitle }).first();
    await expect(assignmentCard).toBeVisible();
    await assignmentCard.getByRole('button', { name: /Submit work|Edit submission/ }).click();
    await assignmentCard.getByLabel('Comment/notes').fill(submissionComment);
    await assignmentCard.getByLabel('Links (one per line)').fill(submissionLink);
    await assignmentCard.getByRole('button', { name: 'Save submission' }).click();
    await expect(assignmentCard.getByText('Submitted')).toBeVisible();

    await assignmentCard.locator('input[type="file"]').setInputFiles({
      name: `submission-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('submission artifact'),
    });
    await assignmentCard.locator('button', { hasText: 'Upload file' }).click();
    await expect(assignmentCard.getByText(`submission-${suffix}.txt`)).toBeVisible();

    await setDevIdentity(page, 'teacher');
    await page.goto('/teacher/homework');
    const teacherAssignmentCard = page.locator('.assignment-card').filter({ hasText: assignmentTitle }).first();
    await expect(teacherAssignmentCard).toBeVisible();
    await teacherAssignmentCard.getByRole('button', { name: 'View submissions' }).click();
    await expect(teacherAssignmentCard.getByText('lucas_chan26@milton.edu')).toBeVisible();
    await expect(teacherAssignmentCard.getByText(submissionComment)).toBeVisible();
    await expect(teacherAssignmentCard.getByText(submissionLink)).toBeVisible();
  });
});
