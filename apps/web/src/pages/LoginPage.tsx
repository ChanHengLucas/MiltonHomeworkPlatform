import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../api';
import { Card } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mock = searchParams.get('mock') === '1';
  const error = searchParams.get('error');

  useEffect(() => {
    if (mock) return;
    api.getAuthMe().then((user) => {
      if (user) navigate('/', { replace: true });
    }).catch(() => {});
  }, [mock, navigate]);

  function handleGoogleLogin() {
    window.location.href = '/auth/google/start';
  }

  if (mock) {
    return (
      <div className="page" style={{ maxWidth: 400, margin: '2rem auto' }}>
        <Card>
          <h1 className="page-title">Mock Auth Mode</h1>
          <p className="page-subtitle">
            In E2E/test mode, use the Dev Identity Switcher in the header to set your identity.
            No Google login required.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <a href="/" className="link">Go to app →</a>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 400, margin: '2rem auto' }}>
      <Card>
        <h1 className="page-title">Sign in</h1>
        <p className="page-subtitle">Use your Milton account to continue.</p>

        {error && (
          <p className="callout-error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 8 }}>
            {error === 'no_code' && 'Authorization was cancelled or failed.'}
            {error === 'callback_failed' && 'Sign-in failed. Please try again.'}
            {!['no_code', 'callback_failed'].includes(error) && `Error: ${error}`}
          </p>
        )}

        <button
          type="button"
          className="ui-btn btn-primary btn-primary-large"
          onClick={handleGoogleLogin}
          style={{ width: '100%' }}
        >
          Sign in with Google
        </button>
      </Card>
    </div>
  );
}
