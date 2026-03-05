import { useAuth } from '../context/AuthContext';
import { useAppState } from '../context/AppContext';

export function useAuthGate() {
  const { authStatus } = useAuth();
  const { identitySource, schoolEmail } = useAppState();

  const isDevIdentity = identitySource === 'dev' && Boolean(schoolEmail.trim());
  const isSignedIn = authStatus === 'signed_in' || isDevIdentity;
  const isLoading = authStatus === 'loading';

  return { isSignedIn, isLoading, isDevIdentity, authStatus };
}
