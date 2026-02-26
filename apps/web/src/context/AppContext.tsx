import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isTeacherEligible, displayNameFromEmail } from '../utils/identity';
import { useAuth } from './AuthContext';

const STORAGE_KEY_TEACHER = 'planner_teacher_mode';
const STORAGE_KEY_EMAIL = 'planner_school_email';
const STORAGE_KEY_DISPLAY_NAME = 'planner_display_name';

function loadTeacherMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_TEACHER) === 'true';
  } catch {
    return false;
  }
}

function loadSchoolEmail(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_EMAIL) || '';
  } catch {
    return '';
  }
}

function loadDisplayName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_DISPLAY_NAME) || '';
  } catch {
    return '';
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
  teacherEligible: boolean;
  suggestedClaimName: string;
  calendarBusyBlocks: CalendarBusyBlock[];
  setCalendarBusyBlocks: (blocks: CalendarBusyBlock[]) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const [teacherMode, setTeacherModeState] = useState(loadTeacherMode);
  const [devEmail, setDevEmail] = useState(loadSchoolEmail);
  const [devDisplayName, setDevDisplayName] = useState(loadDisplayName);

  const schoolEmail = authUser?.email ?? devEmail;
  const displayName = authUser?.name ?? devDisplayName;
  const teacherEligible = useMemo(() => isTeacherEligible(schoolEmail), [schoolEmail]);

  useEffect(() => {
    if (!authUser && import.meta.env.DEV) {
      setDevEmail(loadSchoolEmail());
      setDevDisplayName(loadDisplayName());
    }
  }, [authUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TEACHER, String(teacherMode));
  }, [teacherMode]);

  useEffect(() => {
    if (!teacherEligible && teacherMode) {
      setTeacherModeState(false);
    }
  }, [teacherEligible, teacherMode]);

  useEffect(() => {
    if (!authUser) {
      localStorage.setItem(STORAGE_KEY_EMAIL, devEmail);
    }
  }, [devEmail, authUser]);

  useEffect(() => {
    if (!authUser) {
      localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, devDisplayName);
    }
  }, [devDisplayName, authUser]);

  const setTeacherMode = useCallback((enabled: boolean) => {
    setTeacherModeState(enabled);
  }, []);

  const setSchoolEmail = useCallback((email: string) => {
    setDevEmail(email);
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setDevDisplayName(name);
  }, []);

  const suggestedClaimName = useMemo(
    () => displayName.trim() || displayNameFromEmail(schoolEmail),
    [displayName, schoolEmail]
  );

  const [calendarBusyBlocks, setCalendarBusyBlocksState] = useState<CalendarBusyBlock[]>([]);
  const setCalendarBusyBlocks = useCallback((blocks: CalendarBusyBlock[]) => {
    setCalendarBusyBlocksState(blocks);
  }, []);

  const value = useMemo(
    () => ({
      teacherMode,
      setTeacherMode,
      schoolEmail,
      setSchoolEmail,
      displayName,
      setDisplayName,
      teacherEligible,
      suggestedClaimName,
      calendarBusyBlocks,
      setCalendarBusyBlocks,
    }),
    [
      teacherMode,
      setTeacherMode,
      schoolEmail,
      setSchoolEmail,
      displayName,
      setDisplayName,
      teacherEligible,
      suggestedClaimName,
      calendarBusyBlocks,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
