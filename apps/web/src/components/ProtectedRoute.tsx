import { Navigate, useLocation } from 'react-router-dom';
import { Card } from './ui';
import { useAuthGate } from '../hooks/useAuthGate';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isSignedIn } = useAuthGate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-shell">
        <Card className="auth-card">
          <div className="auth-header">
            <span className="status-chip status-open auth-mode-badge">Loading</span>
            <h1 className="page-title">Preparing your workspace</h1>
            <p className="page-subtitle">Checking authentication…</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
