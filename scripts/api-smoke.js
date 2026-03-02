#!/usr/bin/env node
/**
 * API smoke tests: health, assignments, requests, claim restrictions.
 * Assumes API is already running (e.g. via run-e2e or manually).
 */

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('/') ? path : '/' + path, API_BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  let failed = 0;

  // Health
  const health = await request('GET', '/api/health');
  if (health.status !== 200 || !health.data?.ok) {
    console.error('FAIL: /api/health');
    failed++;
  } else {
    console.log('PASS: /api/health');
  }

  // DB health probe
  const dbHealth = await request('GET', '/api/db/health');
  if (dbHealth.status !== 200 || !dbHealth.data?.ok || !dbHealth.data?.dbFile) {
    console.error('FAIL: /api/db/health', dbHealth.status, dbHealth.data);
    failed++;
  } else {
    console.log('PASS: /api/db/health');
  }

  // Create assignment
  const createA = await request('POST', '/api/assignments', {
    course: 'Smoke',
    title: 'Smoke test assignment',
    estMinutes: 30,
    priority: 3,
    type: 'homework',
  });
  if ((createA.status !== 200 && createA.status !== 201) || !createA.data?.id) {
    console.error('FAIL: create assignment', createA.status, createA.data);
    failed++;
  } else {
    console.log('PASS: create assignment');
  }

  // List assignments
  const listA = await request('GET', '/api/assignments');
  if (listA.status !== 200 || !Array.isArray(listA.data)) {
    console.error('FAIL: list assignments');
    failed++;
  } else {
    console.log('PASS: list assignments');
  }

  // Create request as Student A
  const createR = await request(
    'POST',
    '/api/requests',
    {
      title: 'Smoke test request',
      description: 'Test',
      subject: 'Math',
      urgency: 'med',
    },
    { 'x-user-email': 'lucas12@milton.edu', 'x-user-name': 'Lucas' }
  );
  if (createR.status !== 201 || !createR.data?.id) {
    console.error('FAIL: create request');
    failed++;
  } else {
    console.log('PASS: create request');
  }
  const reqId = createR.data?.id;
  if (!reqId) {
    console.error('FAIL: no request id from create');
    failed++;
  }

  // Teacher-only request claim restriction
  const createRestricted = await request(
    'POST',
    '/api/requests',
    {
      title: 'Teacher only request',
      description: 'Claim restriction smoke test',
      subject: 'Math',
      urgency: 'med',
      claimMode: 'teacher_only',
    },
    { 'x-user-email': 'lucas12@milton.edu', 'x-user-name': 'Lucas' }
  );
  if (createRestricted.status !== 201 || !createRestricted.data?.id) {
    console.error('FAIL: create teacher-only request');
    failed++;
  } else {
    const blocked = await request(
      'POST',
      `/api/requests/${createRestricted.data.id}/claim`,
      { claimedBy: 'Test Student' },
      { 'x-user-email': 'test34@milton.edu', 'x-user-name': 'Test Student' }
    );
    if (blocked.status !== 403) {
      console.error('FAIL: teacher-only claim should block student', blocked.status, blocked.data);
      failed++;
    } else {
      console.log('PASS: teacher-only claim restriction');
    }
  }

  const hasCreator = reqId && createR.data?.createdByEmail;
  if (!hasCreator) {
    console.log('SKIP: self-claim (createdByEmail not set - ensure X-User-Email header is sent)');
  } else {
    // Self-claim blocked (same user as creator)
    const selfClaim = await request(
      'POST',
      `/api/requests/${reqId}/claim`,
      { claimedBy: 'Lucas' },
      { 'X-User-Email': 'lucas12@milton.edu', 'X-User-Name': 'Lucas' }
    );
    if (selfClaim.status === 200) {
      console.error('FAIL: self-claim should be blocked (got 200)', JSON.stringify(selfClaim.data));
      failed++;
    } else if (selfClaim.status === 400 && selfClaim.data?.error && /can't|cannot|own/.test(selfClaim.data.error)) {
      console.log('PASS: self-claim blocked');
    } else {
      console.error('FAIL: unexpected self-claim response', 'status=', selfClaim.status, 'data=', JSON.stringify(selfClaim.data));
      failed++;
    }
  }

  // Claim as Student B (different user) - if already claimed by self-claim, this will still return 200 with the request
  const claimB = await request(
    'POST',
    `/api/requests/${reqId}/claim`,
    { claimedBy: 'Test Student' },
    { 'X-User-Email': 'test34@milton.edu', 'X-User-Name': 'Test Student' }
  );
  if (claimB.status !== 200 || claimB.data?.status !== 'claimed') {
    console.error('FAIL: claim as Student B');
    failed++;
  } else {
    console.log('PASS: claim as Student B');
  }

  // Course assignment notification + feedback summary
  const suffix = Date.now();
  const createCourse = await request(
    'POST',
    '/api/teacher/courses',
    { name: `Smoke Course ${suffix}` },
    { 'x-user-email': 'hales@milton.edu', 'x-user-name': 'Mr. Hales' }
  );
  if (createCourse.status !== 201 || !createCourse.data?.id || !createCourse.data?.courseCode) {
    console.error('FAIL: create teacher course for notifications/feedback', createCourse.status, createCourse.data);
    failed++;
  } else {
    const joinByCode = await request(
      'POST',
      '/api/student/courses/join-code',
      { courseCode: createCourse.data.courseCode },
      { 'x-user-email': 'lucas12@milton.edu', 'x-user-name': 'Lucas' }
    );
    if (joinByCode.status !== 200) {
      console.error('FAIL: join course by code', joinByCode.status, joinByCode.data);
      failed++;
    } else {
      const postAssignment = await request(
        'POST',
        '/api/teacher/assignments',
        {
          courseId: createCourse.data.id,
          title: `Notification Assignment ${suffix}`,
          dueAtMs: Date.now() + 72 * 60 * 60 * 1000,
          estMinutes: 30,
          type: 'homework',
        },
        { 'x-user-email': 'hales@milton.edu', 'x-user-name': 'Mr. Hales' }
      );
      if (postAssignment.status !== 201) {
        console.error('FAIL: post assignment for notification', postAssignment.status, postAssignment.data);
        failed++;
      } else {
        const notifications = await request(
          'GET',
          '/api/notifications?limit=20',
          null,
          { 'x-user-email': 'lucas12@milton.edu', 'x-user-name': 'Lucas' }
        );
        const hasAssignmentNotification = notifications.status === 200
          && Array.isArray(notifications.data)
          && notifications.data.some((n) => n.type === 'assignment_posted');
        if (!hasAssignmentNotification) {
          console.error('FAIL: assignment notification missing', notifications.status, notifications.data);
          failed++;
        } else {
          console.log('PASS: assignment notification created');
        }
      }

      const submitFeedback = await request(
        'POST',
        `/api/student/courses/${createCourse.data.id}/feedback`,
        { rating: 4, comment: 'Good pace in class.' },
        { 'x-user-email': 'lucas12@milton.edu', 'x-user-name': 'Lucas' }
      );
      if (submitFeedback.status !== 201) {
        console.error('FAIL: submit feedback', submitFeedback.status, submitFeedback.data);
        failed++;
      } else {
        const feedbackSummary = await request(
          'GET',
          `/api/teacher/courses/${createCourse.data.id}/feedback`,
          null,
          { 'x-user-email': 'hales@milton.edu', 'x-user-name': 'Mr. Hales' }
        );
        const feedbackOk = feedbackSummary.status === 200
          && feedbackSummary.data?.totalResponses >= 1
          && Array.isArray(feedbackSummary.data?.ratingBreakdown);
        if (!feedbackOk) {
          console.error('FAIL: feedback summary', feedbackSummary.status, feedbackSummary.data);
          failed++;
        } else {
          console.log('PASS: feedback summary visible to teacher');
        }
      }
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} smoke test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll API smoke tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
