import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, type AuthUser } from '../api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const u = await api.getAuthMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = { user, loading, refetch, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
