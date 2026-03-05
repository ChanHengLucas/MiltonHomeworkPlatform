import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DevIdentitySwitcher } from '../components/DevIdentitySwitcher';
import { Button, Card } from '../components/ui';

export function DevPage() {
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [dbHealthStatus, setDbHealthStatus] = useState<string>('');

  if (import.meta.env.PROD) return null;

  return (
    <div className="page">
      <h1 className="page-title">Dev Tools</h1>
      <p className="page-subtitle">Development-only identity and QA utilities.</p>

      <Card>
        <h2 className="section-title">Identity</h2>
        <DevIdentitySwitcher />
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

