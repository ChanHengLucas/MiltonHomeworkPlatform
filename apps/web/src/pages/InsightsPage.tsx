import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { api, type RequestsSummaryRow } from '../api';
import { useAppState } from '../context/AppContext';
import { Button, Card, Callout } from '../components/ui';
import { useAuthGate } from '../hooks/useAuthGate';

function urgencyLabel(u: string): string {
  return u === 'med' ? 'Medium' : u.charAt(0).toUpperCase() + u.slice(1);
}

export function InsightsPage() {
  const { teacherEligible } = useAppState();
  const { isSignedIn } = useAuthGate();
  const [summary, setSummary] = useState<RequestsSummaryRow[]>([]);
  const [stats, setStats] = useState<{
    totalOpen: number;
    totalClaimed: number;
    totalClosed: number;
    topSubjectsByOpen: { subject: string; count: number }[];
  } | null>(null);
  const [reports, setReports] = useState<{
    reports: { requestId: string; reportedEmail: string; reason: string; reportedByEmail: string; createdAt: string }[];
    countsByReportedEmail: { reportedEmail: string; count: number }[];
  } | null>(null);
  const [blocklist, setBlocklist] = useState<{ id: string; blockedEmail: string; blockedUntil: string; blockedByEmail: string; createdAt: string }[]>([]);
  const [blockEmail, setBlockEmail] = useState('');
  const [blockUntil, setBlockUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      setSummary([]);
      setStats(null);
      setReports(null);
      setBlocklist([]);
      setError(null);
      return;
    }
    if (teacherEligible) load();
  }, [teacherEligible, isSignedIn]);

  async function load() {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      setError(null);
      const [summaryData, statsData, reportsData, blocklistData] = await Promise.all([
        api.getRequestsSummary(),
        api.getInsightsStats(),
        api.getReports(),
        api.getBlocklist(),
      ]);
      setSummary(summaryData);
      setStats(statsData);
      setReports({
        reports: reportsData.reports as { requestId: string; reportedEmail: string; reason: string; reportedByEmail: string; createdAt: string }[],
        countsByReportedEmail: reportsData.countsByReportedEmail,
      });
      setBlocklist(blocklistData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load insights';
      setError(msg);
      console.error('[Planner] [API]', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddBlock() {
    if (!isSignedIn) return;
    if (!blockEmail.trim() || !blockUntil.trim()) return;
    try {
      setError(null);
      await api.addBlocklist(blockEmail.trim(), blockUntil.trim());
      setBlockEmail('');
      setBlockUntil('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add block');
    }
  }

  if (!teacherEligible) {
    return (
      <div className="page">
        <h1 className="page-title">Teacher dashboard only</h1>
        <p className="page-subtitle">
          Insights are available to teachers and staff only. This page shows Support Hub activity overview.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/support" className="link">
            ← Back to Support Hub
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Support Hub activity overview</h1>
      <p className="page-subtitle">
        Counts of help requests by subject, urgency, and status. Not a measure of subject difficulty.
      </p>

      <p style={{ marginBottom: '1rem' }}>
        <Link to="/support" className="link">
          Go to Support Hub →
        </Link>
      </p>

      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {stats && (
            <Card>
              <h2 className="section-title">Counts</h2>
              <p>Total open: {stats.totalOpen} · Total claimed: {stats.totalClaimed} · Total closed: {stats.totalClosed}</p>
              {stats.topSubjectsByOpen.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong>Top subjects (open):</strong>{' '}
                  {stats.topSubjectsByOpen.map((s) => `${s.subject} (${s.count})`).join(', ')}
                </div>
              )}
            </Card>
          )}

          {blocklist.length > 0 && (
            <Card>
              <h2 className="section-title">Blocked claimers</h2>
              <ul className="comment-list" style={{ marginBottom: '1rem' }}>
                {blocklist.map((b) => (
                  <li key={b.id} className="comment-item">
                    {b.blockedEmail} until {new Date(b.blockedUntil).toLocaleDateString()} (by {b.blockedByEmail})
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="section-title">Block claimer</h2>
            <p className="form-hint" style={{ marginBottom: '0.75rem' }}>Block an email from claiming requests until a date.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Email</label>
                <input
                  className="ui-input"
                  type="email"
                  value={blockEmail}
                  onChange={(e) => setBlockEmail(e.target.value)}
                  placeholder="user@milton.edu"
                  style={{ width: 200 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Block until (date)</label>
                <input
                  className="ui-input"
                  type="date"
                  value={blockUntil}
                  onChange={(e) => setBlockUntil(e.target.value)}
                  style={{ width: 160 }}
                />
              </div>
              <Button onClick={handleAddBlock} disabled={!blockEmail.trim() || !blockUntil.trim()}>
                Add block
              </Button>
            </div>
          </Card>

          {reports && (reports.reports.length > 0 || reports.countsByReportedEmail.length > 0) && (
            <Card>
              <h2 className="section-title">Reports</h2>
              {reports.countsByReportedEmail.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Top reported by email:</strong>{' '}
                  {reports.countsByReportedEmail.map((s) => `${s.reportedEmail} (${s.count})`).join(', ')}
                </div>
              )}
              {reports.reports.length > 0 || reports.countsByReportedEmail.length === 0 ? (
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Reported</th>
                      <th>Reason</th>
                      <th>By</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.reports.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td><Link to={`/support/${r.requestId}`} className="link">View</Link></td>
                        <td>{r.reportedEmail}</td>
                        <td>{r.reason}</td>
                        <td>{r.reportedByEmail}</td>
                        <td>{new Date(r.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {reports.reports.length === 0 && reports.countsByReportedEmail.length > 0 && (
                <p className="empty-state">No recent reports.</p>
              )}
            </Card>
          )}

          {summary.length === 0 ? (
            <Card>
              <p className="empty-state">No help requests yet.</p>
            </Card>
          ) : (
            <Card>
              <h2 className="section-title">Requests summary</h2>
              <table className="insights-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, i) => (
                    <tr key={i}>
                      <td>{row.subject}</td>
                      <td>{urgencyLabel(row.urgency)}</td>
                      <td>{row.status}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
