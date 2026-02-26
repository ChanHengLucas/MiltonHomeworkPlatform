import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const allowWithoutAuth = import.meta.env.DEV || import.meta.env.VITE_E2E_TEST === '1';

  if (loading) {
    return <p>Loading…</p>;
  }

  if (!user && !allowWithoutAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
