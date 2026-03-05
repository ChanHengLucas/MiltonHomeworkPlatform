import { Navigate, useLocation } from 'react-router-dom';
import { useAuthGate } from '../hooks/useAuthGate';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isSignedIn } = useAuthGate();
  const location = useLocation();

  if (isLoading) {
    return <p>Loading…</p>;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
