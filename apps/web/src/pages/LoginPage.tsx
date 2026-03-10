import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button, Card, Callout } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../hooks/useIdentity';

function errorMessage(code: string): string {
  if (code === 'no_code') return 'Authorization was cancelled or failed.';
  if (code === 'callback_failed') return 'Sign-in failed. Please try again.';
  return `Error: ${code}`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mock = searchParams.get('mock') === '1';
  const dev = searchParams.get('dev') === '1';
  const error = searchParams.get('error');
  const { user, loading } = useAuth();
  const { source, profile } = useIdentity();

  const isDevMode = import.meta.env.DEV && source === 'dev';
  const devIdentityActive = isDevMode && !!profile?.email?.trim();

  useEffect(() => {
    if (devIdentityActive) {
      navigate('/', { replace: true });
      return;
    }
    if (mock || dev) return;
    if (loading) return;
    if (user) {
      navigate('/', { replace: true });
    }
  }, [dev, devIdentityActive, loading, mock, navigate, user]);

  function handleGoogleLogin() {
    window.location.href = '/api/auth/google/start';
  }

  if (loading && !devIdentityActive && !mock) {
    return (
      <div className="auth-shell">
        <Card className="auth-card">
          <div className="auth-header">
            <span className="status-chip status-open auth-mode-badge">Checking Auth</span>
            <h1 className="page-title">Sign in</h1>
            <p className="page-subtitle">Checking authentication status…</p>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
              <div className="ui-spinner" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (mock) {
    return (
      <div className="auth-shell">
        <Card className="auth-card">
          <div className="auth-header">
            <span className="status-chip status-claimed auth-mode-badge">Mock Auth</span>
            <h1 className="page-title">Sign in</h1>
            <p className="page-subtitle">Student mode is active for local and E2E flows.</p>
          </div>
          <p className="auth-subcopy">
            Use the Dev Identity page (<code>/dev</code>) to set identity. Google login is not required.
          </p>
          <div className="auth-actions">
            <Link to="/dev" className="ui-btn btn-primary btn-lg">
              Open Dev Identity
            </Link>
            <Link to="/" className="ui-btn btn-secondary">
              Continue to app
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <div className="auth-header">
          <span className={`status-chip ${isDevMode ? 'status-claimed' : 'status-open'} auth-mode-badge`}>
            {isDevMode ? 'DEV MODE' : 'Google Auth'}
          </span>
          <h1 className="page-title">Sign in</h1>
          <p className="page-subtitle">
            {isDevMode
              ? 'DEV MODE (no Google). Choose a dev identity to continue.'
              : 'Use your Milton Google account to continue.'}
          </p>
          {isDevMode && (
            <p className="auth-subcopy">
              {profile?.email
                ? `Dev identity active (${profile.email}).`
                : 'Dev auth mode is active. Set an identity in /dev.'}{' '}
              Google login is disabled.
            </p>
          )}
          {dev && (
            <p className="auth-subcopy">
              Returned from OAuth callback while API is running in dev auth mode.
            </p>
          )}
        </div>

        {error && (
          <Callout variant="error">
            {errorMessage(error)}
          </Callout>
        )}

        {isDevMode ? (
          <div className="auth-actions">
            <Link to="/dev" className="ui-btn btn-primary btn-lg">
              {profile?.email ? 'Switch Dev Identity' : 'Sign in (Dev Identity)'}
            </Link>
            {profile?.email && (
              <Link to="/" className="ui-btn btn-secondary">
                Continue to app
              </Link>
            )}
          </div>
        ) : (
          <div className="auth-actions">
            <Button type="button" onClick={handleGoogleLogin} className="btn-primary-large">
              Sign in with Google
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
