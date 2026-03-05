import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isTeacherEligible, displayNameFromEmail } from '../utils/identity';
import { useIdentity, type IdentitySource } from '../hooks/useIdentity';

const STORAGE_KEY_TEACHER = 'planner_teacher_mode';

function loadTeacherMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_TEACHER) === 'true';
  } catch {
    return false;
  }
}

export interface CalendarBusyBlock {
  startMs: number;
  endMs: number;
  source: string;
}

interface AppState {
  teacherMode: boolean;
  setTeacherMode: (enabled: boolean) => void;
  schoolEmail: string;
  setSchoolEmail: (email: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  identitySource: IdentitySource;
  teacherEligible: boolean;
  suggestedClaimName: string;
  calendarBusyBlocks: CalendarBusyBlock[];
  calendarBusyUpdatedAt: number | null;
  setCalendarBusyBlocks: (blocks: CalendarBusyBlock[]) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { source, profile, setDevIdentity } = useIdentity();
  const [teacherMode, setTeacherModeState] = useState(loadTeacherMode);
  const schoolEmail = profile?.email ?? '';
  const displayName = profile?.name ?? '';
  const devIdentityDraftRef = useRef<{ email: string; name: string }>({ email: schoolEmail, name: displayName });
  const teacherEligible = useMemo(() => isTeacherEligible(schoolEmail), [schoolEmail]);

  useEffect(() => {
    devIdentityDraftRef.current = { email: schoolEmail, name: displayName };
  }, [schoolEmail, displayName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TEACHER, String(teacherMode));
  }, [teacherMode]);

  useEffect(() => {
    if (!teacherEligible && teacherMode) {
      setTeacherModeState(false);
    }
  }, [teacherEligible, teacherMode]);

  const setTeacherMode = useCallback((enabled: boolean) => {
    setTeacherModeState(enabled);
  }, []);

  const setSchoolEmail = useCallback((email: string) => {
    const next = { email, name: devIdentityDraftRef.current.name };
    devIdentityDraftRef.current = next;
    setDevIdentity(next.email, next.name);
  }, [setDevIdentity]);

  const setDisplayName = useCallback((name: string) => {
    const next = { email: devIdentityDraftRef.current.email, name };
    devIdentityDraftRef.current = next;
    setDevIdentity(next.email, next.name);
  }, [setDevIdentity]);

  const suggestedClaimName = useMemo(
    () => displayName.trim() || displayNameFromEmail(schoolEmail),
    [displayName, schoolEmail]
  );

  const [calendarBusyBlocks, setCalendarBusyBlocksState] = useState<CalendarBusyBlock[]>([]);
  const [calendarBusyUpdatedAt, setCalendarBusyUpdatedAt] = useState<number | null>(null);
  const setCalendarBusyBlocks = useCallback((blocks: CalendarBusyBlock[]) => {
    setCalendarBusyBlocksState(blocks);
    setCalendarBusyUpdatedAt(Date.now());
  }, []);

  const value = useMemo(
    () => ({
      teacherMode,
      setTeacherMode,
      schoolEmail,
      setSchoolEmail,
      displayName,
      setDisplayName,
      identitySource: source,
      teacherEligible,
      suggestedClaimName,
      calendarBusyBlocks,
      calendarBusyUpdatedAt,
      setCalendarBusyBlocks,
    }),
    [
      teacherMode,
      setTeacherMode,
      schoolEmail,
      setSchoolEmail,
      displayName,
      setDisplayName,
      source,
      teacherEligible,
      suggestedClaimName,
      calendarBusyBlocks,
      calendarBusyUpdatedAt,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
