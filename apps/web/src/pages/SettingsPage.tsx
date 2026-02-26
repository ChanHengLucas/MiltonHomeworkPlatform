import { useState } from 'react';
import { useAppState } from '../context/AppContext';
import { api } from '../api';
import { Button, Card } from '../components/ui';

export function SettingsPage() {
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const {
    teacherMode,
    setTeacherMode,
    schoolEmail,
    setSchoolEmail,
    displayName,
    setDisplayName,
    teacherEligible,
  } = useAppState();

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <Card>
        <h2 className="section-title">Your Identity</h2>
        <div className="form-group">
          <label>Your school email</label>
          <input
            className="ui-input"
            type="email"
            placeholder="e.g. jsmith@milton.edu"
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Display name</label>
          <input
            className="ui-input"
            placeholder="Name shown when claiming requests"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <label className={`toggle-row ${!teacherEligible ? 'toggle-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={teacherMode}
            onChange={(e) => teacherEligible && setTeacherMode(e.target.checked)}
            disabled={!teacherEligible}
          />
          <span>Teacher Mode</span>
        </label>
        {!teacherEligible && (
          <p className="form-hint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            Teacher mode is only available for faculty accounts.
          </p>
        )}
      </Card>

      <Card>
        <label className="toggle-row toggle-disabled">
          <input type="checkbox" disabled />
          <span>AI features (coming later)</span>
        </label>
      </Card>

      {import.meta.env.DEV && (
        <Card>
          <h2 className="section-title">Dev</h2>
          <Button
            variant="secondary"
            disabled={cleanupRunning}
            onClick={async () => {
              setCleanupRunning(true);
              setCleanupResult(null);
              try {
                const r = await api.cleanupClosed(7);
                setCleanupResult(`Deleted ${r.deletedRequests} requests, ${r.deletedComments} comments`);
              } catch (e) {
                setCleanupResult(e instanceof Error ? e.message : 'Failed');
              } finally {
                setCleanupRunning(false);
              }
            }}
          >
            {cleanupRunning ? 'Running…' : 'Run cleanup now'}
          </Button>
          {cleanupResult && <p className="form-hint" style={{ marginTop: '0.5rem' }}>{cleanupResult}</p>}
        </Card>
      )}
    </div>
  );
}
