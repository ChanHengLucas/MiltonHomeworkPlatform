import { useCallback, useMemo, useState } from 'react';
import type { AuthUser } from '../api';
import { useAuth } from '../context/AuthContext';
import { displayNameFromEmail, isTeacherEligible } from '../utils/identity';

const STORAGE_KEY_EMAIL = 'planner_school_email';
const STORAGE_KEY_DISPLAY_NAME = 'planner_display_name';

export type IdentitySource = 'dev' | 'google' | 'none';

export interface IdentityProfile {
  email: string;
  name: string;
  picture: string | null;
  isTeacher: boolean;
}

function loadDevIdentity(): { email: string; name: string } {
  try {
    return {
      email: localStorage.getItem(STORAGE_KEY_EMAIL) || '',
      name: localStorage.getItem(STORAGE_KEY_DISPLAY_NAME) || '',
    };
  } catch {
    return { email: '', name: '' };
  }
}

function toProfile(user: AuthUser): IdentityProfile {
  return {
    email: user.email,
    name: user.name,
    picture: user.picture,
    isTeacher: user.isTeacher,
  };
}

export function useIdentity() {
  const { user, loading, logout, refetch, authMode } = useAuth();
  const [devIdentity, setDevIdentityState] = useState(loadDevIdentity);

  const devModeAvailable = import.meta.env.DEV && authMode !== 'google';
  const devIdentityActive = devModeAvailable && !!devIdentity.email.trim();
  const serverDevMode = devModeAvailable && authMode === 'dev';
  const source: IdentitySource = (devIdentityActive || serverDevMode) ? 'dev' : user ? 'google' : 'none';

  const profile = useMemo<IdentityProfile | null>(() => {
    if (devIdentityActive) {
      const email = devIdentity.email.trim();
      if (!email) return null;
      return {
        email,
        name: devIdentity.name.trim() || displayNameFromEmail(email),
        picture: null,
        isTeacher: isTeacherEligible(email),
      };
    }
    if (serverDevMode && user?.email) {
      return {
        email: user.email,
        name: user.name || displayNameFromEmail(user.email),
        picture: null,
        isTeacher: user.isTeacher,
      };
    }
    if (source === 'google' && user) {
      return toProfile(user);
    }
    return null;
  }, [devIdentity.email, devIdentity.name, devIdentityActive, serverDevMode, source, user]);

  const setDevIdentity = useCallback((email: string, name: string) => {
    if (!devModeAvailable) return;
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    try {
      if (!trimmedEmail) {
        localStorage.removeItem(STORAGE_KEY_EMAIL);
        localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME);
      } else {
        localStorage.setItem(STORAGE_KEY_EMAIL, trimmedEmail);
        localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, trimmedName);
      }
    } catch {
      // ignore localStorage write errors in environments where storage is blocked
    }
    setDevIdentityState({
      email: trimmedEmail,
      name: trimmedName,
    });
  }, [devModeAvailable]);

  const clearDevIdentity = useCallback(() => {
    setDevIdentity('', '');
  }, [setDevIdentity]);

  return {
    source,
    profile,
    isDevMode: source === 'dev',
    loading: source === 'dev' ? false : loading,
    authMode,
    devModeAvailable,
    setDevIdentity,
    clearDevIdentity,
    refetchGoogleIdentity: refetch,
    logoutGoogle: logout,
  };
}
