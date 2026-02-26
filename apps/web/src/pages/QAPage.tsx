import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppState } from '../context/AppContext';
import { Button, Card } from '../components/ui';

const MINUTES_PER_DAY = 24 * 60;

function getNextWeekEpoch(): number {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

export function QAPage() {
  const navigate = useNavigate();
  const { schoolEmail, setSchoolEmail, setDisplayName } = useAppState();
  const [results, setResults] = useState<Record<string, boolean | string>>({});
  const [running, setRunning] = useState(false);

  function setResult(key: string, ok: boolean, details?: string) {
    setResults((r) => ({ ...r, [key]: ok ? 'PASS' : details || 'FAIL' }));
  }

  function setIdentity(email: string, name: string) {
    localStorage.setItem('planner_school_email', email);
    localStorage.setItem('planner_display_name', name);
    setSchoolEmail(email);
    setDisplayName(name);
  }

  async function seedDemoData() {
    setRunning(true);
    setResults({});

    try {
      setIdentity('lucas12@milton.edu', 'Lucas Chan');

      const dueAt = getNextWeekEpoch();
      const a = await api.createAssignment({
        course: 'Math',
        title: 'QA Demo: Chapter 5 Review',
        dueAt,
        estMinutes: 45,
        priority: 3,
        type: 'homework',
      });
      setResult('seed-assignment', !!a, a?.id);

      const startMin = 2 * MINUTES_PER_DAY + 19 * 60;
      const endMin = 2 * MINUTES_PER_DAY + 22 * 60;
      const block = await api.createAvailability(startMin, endMin);
      setResult('seed-availability', !!block, block?.id);

      const plan = await api.createPlan(30);
      setResult('seed-plan', plan.sessions.length > 0 || plan.warnings.length > 0, plan.warnings[0] || `${plan.sessions.length} sessions`);

      const req = await api.createRequest({
        title: 'QA Demo: Help with Chapter 5',
        description: 'I need help understanding the homework.',
        subject: 'Math',
        urgency: 'med',
        linkedAssignmentId: a?.id ?? null,
      });
      setResult('seed-request', !!req, req?.id);

      const req2 = await api.createRequest({
        title: 'QA Demo: Self-claim test request',
        description: 'For testing self-claim block.',
        subject: 'Math',
        urgency: 'low',
      });
      setResult('seed-request2', !!req2, req2?.id);

      setResult('seed', true);
    } catch (e) {
      setResult('seed', false, e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  async function testClaimAsOther() {
    setRunning(true);
    setResults((r) => ({ ...r, claimOther: undefined }));

    try {
      const requests = await api.listRequests({ showClosed: true });
      const openReq = requests.find((r) => r.status === 'open' && r.createdByEmail === 'lucas12@milton.edu');
      if (!openReq) {
        setResult('claimOther', false, 'No open request from Student A');
        return;
      }

      setIdentity('test34@milton.edu', 'Test Student');

      const claimed = await api.claimRequest(openReq.id, 'Test Student');
      setResult('claimOther', claimed?.status === 'claimed', claimed?.claimedBy ?? '');
    } catch (e) {
      setResult('claimOther', false, e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  async function testSelfClaimBlocked() {
    setRunning(true);
    setResults((r) => ({ ...r, selfClaimBlocked: undefined }));

    try {
      setIdentity('lucas12@milton.edu', 'Lucas Chan');

      const requests = await api.listRequests({ showClosed: true });
      const openReq = requests.find(
        (r) => r.status === 'open' && r.createdByEmail === 'lucas12@milton.edu' && r.title?.includes('Self-claim')
      );
      if (!openReq) {
        setResult('selfClaimBlocked', false, 'No open request for self-claim test (run Seed first)');
        return;
      }

      await api.claimRequest(openReq.id, 'Lucas Chan');
      setResult('selfClaimBlocked', false, 'Should have been blocked');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setResult('selfClaimBlocked', msg.includes("can't") && msg.includes('own'), msg);
    } finally {
      setRunning(false);
    }
  }

  async function testCommentAsHelper() {
    setRunning(true);
    setResults((r) => ({ ...r, commentHelper: undefined }));

    try {
      const requests = await api.listRequests({ showClosed: true });
      const claimedReq = requests.find((r) => r.status === 'claimed' && r.claimedByEmail === 'test34@milton.edu');
      if (!claimedReq) {
        setResult('commentHelper', false, 'No claimed request by Student B');
        return;
      }

      setIdentity('test34@milton.edu', 'Test Student');

      const comment = await api.addComment(claimedReq.id, 'I can help with this!');
      setResult('commentHelper', comment?.authorLabel === 'helper', comment?.authorLabel ?? '');
    } catch (e) {
      setResult('commentHelper', false, e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  async function testTeacherInsights() {
    setRunning(true);
    setResults((r) => ({ ...r, teacherInsights: undefined }));

    try {
      setIdentity('hales@milton.edu', 'Mr. Hales');

      const stats = await api.getInsightsStats();
      setResult('teacherInsights', stats != null, 'Stats loaded');
    } catch (e) {
      setResult('teacherInsights', false, e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  if (import.meta.env.PROD) return null;

  return (
    <div className="page">
      <h1 className="page-title">QA Test Harness</h1>
      <p className="page-subtitle">Dev-only: Run demo flows and verify planner + support.</p>

      <Card>
        <h2 className="section-title">1. Seed Demo Data</h2>
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
          Creates assignment, availability, plan, and help request as Student A (lucas12@milton.edu).
        </p>
        <Button onClick={seedDemoData} disabled={running}>
          {running ? 'Running…' : 'Seed Demo Data'}
        </Button>
        {results.seed !== undefined && (
          <span className={results.seed === 'PASS' ? 'qa-pass' : 'qa-fail'} style={{ marginLeft: '1rem' }}>
            {results.seed === 'PASS' ? '✓ PASS' : `✗ ${results.seed}`}
          </span>
        )}
      </Card>

      <Card>
        <h2 className="section-title">2. Quick Actions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <Button variant="secondary" onClick={() => navigate('/assignments')}>
            Assignments
          </Button>
          <Button variant="secondary" onClick={() => navigate('/availability')}>
            Availability
          </Button>
          <Button variant="secondary" onClick={() => navigate('/plan')}>
            Plan
          </Button>
          <Button variant="secondary" onClick={() => navigate('/support')}>
            Support
          </Button>
          <Button variant="secondary" onClick={() => navigate('/insights')}>
            Insights
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">3. Run Demo Tests</h2>
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
          Run these in order after seeding. Switch identity via header dropdown.
        </p>
        <div className="qa-test-list">
          <div className="qa-test-row">
            <Button variant="secondary" size="sm" onClick={testClaimAsOther} disabled={running}>
              Claim as Student B
            </Button>
            <span className={results.claimOther === 'PASS' ? 'qa-pass' : results.claimOther ? 'qa-fail' : ''}>
              {results.claimOther === 'PASS' ? '✓ PASS' : results.claimOther ? `✗ ${results.claimOther}` : ''}
            </span>
          </div>
          <div className="qa-test-row">
            <Button variant="secondary" size="sm" onClick={testCommentAsHelper} disabled={running}>
              Comment as Student B (Helper)
            </Button>
            <span className={results.commentHelper === 'PASS' ? 'qa-pass' : results.commentHelper ? 'qa-fail' : ''}>
              {results.commentHelper === 'PASS' ? '✓ PASS' : results.commentHelper ? `✗ ${results.commentHelper}` : ''}
            </span>
          </div>
          <div className="qa-test-row">
            <Button variant="secondary" size="sm" onClick={testSelfClaimBlocked} disabled={running}>
              Self-claim blocked (Student A)
            </Button>
            <span className={results.selfClaimBlocked === 'PASS' ? 'qa-pass' : results.selfClaimBlocked ? 'qa-fail' : ''}>
              {results.selfClaimBlocked === 'PASS' ? '✓ PASS' : results.selfClaimBlocked ? `✗ ${results.selfClaimBlocked}` : ''}
            </span>
          </div>
          <div className="qa-test-row">
            <Button variant="secondary" size="sm" onClick={testTeacherInsights} disabled={running}>
              Teacher Insights
            </Button>
            <span className={results.teacherInsights === 'PASS' ? 'qa-pass' : results.teacherInsights ? 'qa-fail' : ''}>
              {results.teacherInsights === 'PASS' ? '✓ PASS' : results.teacherInsights ? `✗ ${results.teacherInsights}` : ''}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">Current Identity</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          {schoolEmail || '(none)'} — Use Dev Identity dropdown in header to switch.
        </p>
      </Card>
    </div>
  );
}
