import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, setApiAuthMode, setApiAuthStatus, type AuthUser } from '../api';

export type AuthStatus = 'loading' | 'signed_in' | 'signed_out';
export type AuthMode = 'dev' | 'google' | null;

interface AuthState {
  user: AuthUser | null;
  authStatus: AuthStatus;
  authMode: AuthMode;
  isSignedIn: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const loading = authStatus === 'loading';

  const refetch = useCallback(async () => {
    setAuthStatus('loading');
    try {
      const u = await api.getAuthMe();
      const mode = u.mode === 'dev' || u.mode === 'google' ? u.mode : null;
      setAuthMode(mode);
      const hasIdentity = Boolean((u.email || '').trim());
      setUser(hasIdentity ? u : null);
      setAuthStatus(hasIdentity ? 'signed_in' : 'signed_out');
    } catch (err) {
      const status = (err as { status?: unknown })?.status;
      const mode = (err as { mode?: unknown })?.mode;
      if (status !== 401) {
        // eslint-disable-next-line no-console
        console.warn('[Auth] /api/auth/me failed', err);
      }
      setAuthMode((prev) => {
        if (mode === 'dev' || mode === 'google') return mode;
        return prev ?? 'google';
      });
      setUser(null);
      setAuthStatus('signed_out');
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
    setAuthMode((prev) => prev ?? 'google');
    setAuthStatus('signed_out');
  }, []);

  useEffect(() => {
    setApiAuthStatus(authStatus);
  }, [authStatus]);

  useEffect(() => {
    setApiAuthMode(authMode);
  }, [authMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAuthRequired = () => {
      setUser(null);
      setAuthMode((prev) => prev ?? 'google');
      setAuthStatus('signed_out');
    };
    window.addEventListener('planner:auth-required', onAuthRequired);
    return () => window.removeEventListener('planner:auth-required', onAuthRequired);
  }, []);

  const value = {
    user,
    authStatus,
    authMode,
    isSignedIn: authStatus === 'signed_in',
    loading,
    refetch,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
