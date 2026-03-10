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

  const authMeStudent = await request(
    'GET',
    '/api/auth/me',
    null,
    { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas Chan' }
  );
  if (authMeStudent.status !== 200 || authMeStudent.data?.role !== 'student' || authMeStudent.data?.isTeacher) {
    console.error('FAIL: auth role detection (student)', authMeStudent.status, authMeStudent.data);
    failed++;
  } else {
    console.log('PASS: auth role detection (student)');
  }

  const authMeTeacher = await request(
    'GET',
    '/api/auth/me',
    null,
    { 'x-user-email': 'john_smith@milton.edu', 'x-user-name': 'John Smith' }
  );
  if (authMeTeacher.status !== 200 || authMeTeacher.data?.role !== 'teacher' || !authMeTeacher.data?.isTeacher) {
    console.error('FAIL: auth role detection (teacher)', authMeTeacher.status, authMeTeacher.data);
    failed++;
  } else {
    console.log('PASS: auth role detection (teacher)');
  }

  // DB health probe
  const dbHealth = await request('GET', '/api/db/health');
  if (dbHealth.status !== 200 || !dbHealth.data?.ok || !dbHealth.data?.dbFile) {
    console.error('FAIL: /api/db/health', dbHealth.status, dbHealth.data);
    failed++;
  } else {
    console.log('PASS: /api/db/health');
  }

  const studentHeaders = { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas Chan' };

  // Create assignment (now requires auth)
  const createA = await request('POST', '/api/assignments', {
    course: 'Smoke',
    title: 'Smoke test assignment',
    estMinutes: 30,
    priority: 3,
    type: 'homework',
  }, studentHeaders);
  if ((createA.status !== 200 && createA.status !== 201) || !createA.data?.id) {
    console.error('FAIL: create assignment', createA.status, createA.data);
    failed++;
  } else {
    console.log('PASS: create assignment');
  }

  // List assignments (now requires auth)
  const listA = await request('GET', '/api/assignments', null, studentHeaders);
  if (listA.status !== 200 || !Array.isArray(listA.data)) {
    console.error('FAIL: list assignments');
    failed++;
  } else {
    console.log('PASS: list assignments');
  }

  // Verify auth guard: unauthenticated request should return 401
  const unauthAssignments = await request('GET', '/api/assignments');
  if (unauthAssignments.status !== 401) {
    console.error('FAIL: unauthenticated /api/assignments should return 401', unauthAssignments.status);
    failed++;
  } else {
    console.log('PASS: assignments auth guard');
  }

  // Create request as Student A
  const createR = await request(
    'POST',
    '/api/requests',
    {
      title: 'Smoke test request',
      description: 'Student',
      subject: 'Math',
      urgency: 'med',
    },
    { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
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
  if (reqId) {
    const addResourceLink = await request(
      'POST',
      `/api/requests/${reqId}/resources/link`,
      { url: 'https://example.com/help-doc', note: 'Reference sheet' },
      { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
    );
    if (addResourceLink.status !== 201 || !addResourceLink.data?.id) {
      console.error('FAIL: add support resource link', addResourceLink.status, addResourceLink.data);
      failed++;
    } else {
      const listResources = await request(
        'GET',
        `/api/requests/${reqId}/resources`,
        null,
        { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
      );
      if (listResources.status !== 200 || !Array.isArray(listResources.data) || listResources.data.length < 1) {
        console.error('FAIL: list support resources', listResources.status, listResources.data);
        failed++;
      } else {
        console.log('PASS: support request resources');
      }
    }
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
    { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
  );
  if (createRestricted.status !== 201 || !createRestricted.data?.id) {
    console.error('FAIL: create teacher-only request');
    failed++;
  } else {
    const blocked = await request(
      'POST',
      `/api/requests/${createRestricted.data.id}/claim`,
      { claimedBy: 'Jane Doe' },
      { 'x-user-email': 'jane_doe27@milton.edu', 'x-user-name': 'Jane Doe' }
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
      { 'X-User-Email': 'lucas_chan26@milton.edu', 'X-User-Name': 'Lucas' }
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
    { claimedBy: 'Jane Doe' },
    { 'X-User-Email': 'jane_doe27@milton.edu', 'X-User-Name': 'Jane Doe' }
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
    { 'x-user-email': 'john_smith@milton.edu', 'x-user-name': 'John Smith' }
  );
  if (createCourse.status !== 201 || !createCourse.data?.id || !createCourse.data?.courseCode) {
    console.error('FAIL: create teacher course for notifications/feedback', createCourse.status, createCourse.data);
    failed++;
  } else {
    const joinByCode = await request(
      'POST',
      '/api/student/courses/join-code',
      { courseCode: createCourse.data.courseCode },
      { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
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
        { 'x-user-email': 'john_smith@milton.edu', 'x-user-name': 'John Smith' }
      );
      if (postAssignment.status !== 201) {
        console.error('FAIL: post assignment for notification', postAssignment.status, postAssignment.data);
        failed++;
      } else {
        const studentSubmission = await request(
          'PUT',
          `/api/student/assignments/${postAssignment.data.id}/submission`,
          {
            comment: 'Draft completed and shared via link.',
            links: ['https://docs.google.com/document/d/demo'],
          },
          { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
        );
        if (studentSubmission.status !== 200 || !studentSubmission.data?.id) {
          console.error('FAIL: student assignment submission', studentSubmission.status, studentSubmission.data);
          failed++;
        } else {
          const uploadSubmissionFile = await request(
            'POST',
            `/api/student/assignments/${postAssignment.data.id}/submission/files`,
            {
              fileName: 'smoke-submission.txt',
              mimeType: 'text/plain',
              contentBase64: 'c21va2Ugc3VibWlzc2lvbg==',
            },
            { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
          );
          if (uploadSubmissionFile.status !== 201 || !uploadSubmissionFile.data?.files?.length) {
            console.error('FAIL: student submission file upload', uploadSubmissionFile.status, uploadSubmissionFile.data);
            failed++;
          } else {
            const teacherSubmissions = await request(
              'GET',
              `/api/teacher/assignments/${postAssignment.data.id}/submissions`,
              null,
              { 'x-user-email': 'john_smith@milton.edu', 'x-user-name': 'John Smith' }
            );
            const hasStudentSubmission = teacherSubmissions.status === 200
              && Array.isArray(teacherSubmissions.data?.submissions)
              && teacherSubmissions.data.submissions.some((s) => s.studentEmail === 'lucas_chan26@milton.edu');
            if (!hasStudentSubmission) {
              console.error('FAIL: teacher assignment submissions view', teacherSubmissions.status, teacherSubmissions.data);
              failed++;
            } else {
              console.log('PASS: assignment submission workflow');
            }
          }
        }

        const notifications = await request(
          'GET',
          '/api/notifications?limit=20',
          null,
          { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
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
        { 'x-user-email': 'lucas_chan26@milton.edu', 'x-user-name': 'Lucas' }
      );
      if (submitFeedback.status !== 201) {
        console.error('FAIL: submit feedback', submitFeedback.status, submitFeedback.data);
        failed++;
      } else {
        const feedbackSummary = await request(
          'GET',
          `/api/teacher/courses/${createCourse.data.id}/feedback`,
          null,
          { 'x-user-email': 'john_smith@milton.edu', 'x-user-name': 'John Smith' }
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
