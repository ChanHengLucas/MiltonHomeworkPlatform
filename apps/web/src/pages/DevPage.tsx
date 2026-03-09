import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DevIdentitySwitcher } from '../components/DevIdentitySwitcher';
import { Button, Card, Callout } from '../components/ui';
import { useIdentity } from '../hooks/useIdentity';

export function DevPage() {
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [dbHealthStatus, setDbHealthStatus] = useState<string>('');
  const { devModeAvailable, profile, source } = useIdentity();

  if (import.meta.env.PROD) return null;

  return (
    <div className="page" style={{ maxWidth: 980, margin: '0 auto' }}>
      <h1 className="page-title">Dev Tools</h1>
      <p className="page-subtitle">Development-only identity, QA utilities, and local diagnostics.</p>

      <Card>
        <div className="split-header">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Auth mode</h2>
          <span className={`status-chip ${source === 'dev' ? 'status-claimed' : 'status-open'}`}>
            {source === 'dev' ? 'Dev auth mode' : 'Google auth mode'}
          </span>
        </div>
        {!devModeAvailable ? (
          <p className="form-hint" style={{ marginBottom: 0 }}>
            OAuth credentials are configured. Dev identity override is disabled.
          </p>
        ) : profile?.email ? (
          <p className="form-hint" style={{ marginBottom: 0 }}>
            Current dev identity: {profile.name} ({profile.email}).
          </p>
        ) : (
          <Callout variant="warn" style={{ marginTop: '0.8rem' }}>
            No dev identity selected yet. Choose one below to sign in as student or teacher.
          </Callout>
        )}
      </Card>

      <Card>
        <h2 className="section-title">Identity</h2>
        <DevIdentitySwitcher />
        <div className="form-actions" style={{ marginTop: '0.75rem' }}>
          <Link to="/login" className="link">Open sign-in screen</Link>
          <Link to="/assignments" className="link">Open app</Link>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">QA Actions</h2>
        <div className="form-actions">
          <Link to="/qa" className="link">Open QA harness</Link>
          <Link to="/support" className="link">Open Support Hub</Link>
          <Link to="/plan" className="link">Open Planner</Link>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">Diagnostics</h2>
        <div className="form-actions">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const status = await api.getApiHealth();
                setHealthStatus(`API online (${new Date(status.timestamp).toLocaleTimeString()})`);
              } catch (err) {
                setHealthStatus(err instanceof Error ? `API offline: ${err.message}` : 'API offline');
              }
            }}
          >
            Check API health
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const status = await api.getDbHealth();
                setDbHealthStatus(`DB OK (${status.dbFile})`);
              } catch (err) {
                setDbHealthStatus(err instanceof Error ? `DB health failed: ${err.message}` : 'DB health failed');
              }
            }}
          >
            Check DB health
          </Button>
        </div>
        {healthStatus && <p className="form-hint" style={{ marginBottom: 0 }}>{healthStatus}</p>}
        {dbHealthStatus && <p className="form-hint" style={{ marginBottom: 0 }}>{dbHealthStatus}</p>}
      </Card>
    </div>
  );
}
