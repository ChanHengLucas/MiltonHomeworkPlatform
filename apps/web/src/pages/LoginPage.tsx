import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../hooks/useIdentity';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mock = searchParams.get('mock') === '1';
  const dev = searchParams.get('dev') === '1';
  const error = searchParams.get('error');
  const { user, loading } = useAuth();
  const { source, profile } = useIdentity();
  const devIdentityActive = import.meta.env.DEV && source === 'dev' && !!profile?.email;

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

  if (mock) {
    return (
      <div className="page" style={{ maxWidth: 400, margin: '2rem auto' }}>
        <Card>
          <h1 className="page-title">Mock Auth Mode</h1>
          <p className="page-subtitle">
            In E2E/test mode, use the Dev Identity page (<code>/dev</code>) to set your identity.
            No Google login required.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <a href="/" className="link">Go to app →</a>
          </p>
        </Card>
      </div>
    );
  }

  if (loading && !devIdentityActive) {
    return (
      <div className="page" style={{ maxWidth: 400, margin: '2rem auto' }}>
        <Card>
          <h1 className="page-title">Sign in</h1>
          <p className="page-subtitle">Checking authentication…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 400, margin: '2rem auto' }}>
      <Card>
        <h1 className="page-title">Sign in</h1>
        <p className="page-subtitle">
          {import.meta.env.DEV && source === 'dev'
            ? 'DEV MODE (no Google). Choose a dev identity to continue.'
            : 'Use your Milton account to continue.'}
        </p>

        {error && (
          <p className="callout-error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 8 }}>
            {error === 'no_code' && 'Authorization was cancelled or failed.'}
            {error === 'callback_failed' && 'Sign-in failed. Please try again.'}
            {!['no_code', 'callback_failed'].includes(error) && `Error: ${error}`}
          </p>
        )}

        {import.meta.env.DEV && source === 'dev' && (
          <p className="form-hint" style={{ marginBottom: '1rem' }}>
            {profile?.email
              ? `Dev identity active (${profile.email}). Google login is disabled.`
              : 'Dev auth mode is active. Set an identity in /dev. Google login is disabled.'}
          </p>
        )}

        {dev && (
          <p className="form-hint" style={{ marginBottom: '1rem' }}>
            Returned from OAuth callback while API is in dev auth mode.
          </p>
        )}

        {!(import.meta.env.DEV && source === 'dev') && (
          <button
            type="button"
            className="ui-btn btn-primary btn-primary-large"
            onClick={handleGoogleLogin}
            style={{ width: '100%' }}
          >
            Sign in with Google
          </button>
        )}
      </Card>
    </div>
  );
}
