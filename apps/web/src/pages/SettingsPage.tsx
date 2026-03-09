import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Button, Card, Callout } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../hooks/useIdentity';

interface PlannerForm {
  studyWindowStartMin: number;
  studyWindowEndMin: number;
  maxSessionMin: number;
  breakBetweenSessionsMin: number;
  avoidLateNight: boolean;
}

function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((part) => parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

function toWeightsText(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  if (entries.length === 0) return '';
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([course, weight]) => `${course}=${weight}`)
    .join('\n');
}

function parseWeightsText(text: string): Record<string, number> {
  const weights: Record<string, number> = {};
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const sep = line.includes('=') ? '=' : line.includes(':') ? ':' : null;
    if (!sep) continue;
    const [courseRaw, weightRaw] = line.split(sep, 2);
    const course = courseRaw.trim().toLowerCase();
    const weight = Number(weightRaw.trim());
    if (!course || !Number.isFinite(weight)) continue;
    weights[course] = Math.max(-5, Math.min(5, Math.round(weight)));
  }
  return weights;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { source, profile, logoutGoogle } = useIdentity();
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSaved, setPrefsSaved] = useState<string | null>(null);
  const [weightsText, setWeightsText] = useState('');
  const [form, setForm] = useState<PlannerForm>({
    studyWindowStartMin: 8 * 60,
    studyWindowEndMin: 22 * 60,
    maxSessionMin: 45,
    breakBetweenSessionsMin: 10,
    avoidLateNight: true,
  });

  const profileLabel = useMemo(() => {
    if (source === 'dev') return 'Dev mode identity (not Google)';
    if (source === 'google') {
      return profile?.isTeacher ? 'Teacher/Staff Google account' : 'Student Google account';
    }
    return 'Not signed in';
  }, [profile?.isTeacher, source]);

  const profileBadgeClass = useMemo(() => {
    if (source === 'dev') return 'status-chip status-claimed';
    if (source === 'google') return 'status-chip status-open';
    return 'status-chip status-closed';
  }, [source]);

  useEffect(() => {
    if (!user) {
      setLoadingPrefs(false);
      setPrefsError(null);
      return;
    }
    loadPreferences();
  }, [user]);

  async function loadPreferences() {
    try {
      setLoadingPrefs(true);
      setPrefsError(null);
      const prefs = await api.getPlannerPreferences();
      setForm({
        studyWindowStartMin: prefs.studyWindowStartMin,
        studyWindowEndMin: prefs.studyWindowEndMin,
        maxSessionMin: prefs.maxSessionMin,
        breakBetweenSessionsMin: prefs.breakBetweenSessionsMin,
        avoidLateNight: prefs.avoidLateNight,
      });
      setWeightsText(toWeightsText(prefs.coursePriorityWeights));
    } catch (e) {
      setPrefsError(e instanceof Error ? e.message : 'Failed to load planner preferences.');
    } finally {
      setLoadingPrefs(false);
    }
  }

  async function handleSavePreferences() {
    if (!user) {
      setPrefsError('Sign in to update planner preferences.');
      return;
    }
    if (form.studyWindowEndMin <= form.studyWindowStartMin) {
      setPrefsError('Preferred study window end must be after start.');
      return;
    }
    try {
      setSavingPrefs(true);
      setPrefsError(null);
      setPrefsSaved(null);
      const saved = await api.updatePlannerPreferences({
        studyWindowStartMin: form.studyWindowStartMin,
        studyWindowEndMin: form.studyWindowEndMin,
        maxSessionMin: form.maxSessionMin,
        breakBetweenSessionsMin: form.breakBetweenSessionsMin,
        avoidLateNight: form.avoidLateNight,
        coursePriorityWeights: parseWeightsText(weightsText),
      });
      setPrefsSaved(`Saved at ${new Date(saved.updatedAt).toLocaleTimeString()}`);
      setWeightsText(toWeightsText(saved.coursePriorityWeights));
    } catch (e) {
      setPrefsError(e instanceof Error ? e.message : 'Failed to save planner preferences.');
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Profile details and planner preferences are saved to your account.</p>

      <Card>
        <div className="split-header">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Profile</h2>
          <span className={profileBadgeClass}>{source === 'dev' ? 'Dev identity' : source === 'google' ? 'Google' : 'Signed out'}</span>
        </div>
        <div className="profile-grid" style={{ marginTop: '0.75rem' }}>
          <div className="profile-item">
            <p className="profile-label">Name</p>
            <p className="profile-value">{profile?.name || 'Not available'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Email</p>
            <p className="profile-value">{profile?.email || 'Not available'}</p>
          </div>
        </div>
        <p className="form-hint" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
          {profileLabel}
        </p>
        {source === 'dev' && (
          <p className="form-hint" style={{ marginBottom: 0, marginTop: '0.35rem' }}>
            Google login is disabled while dev identity mode is active. Open <Link className="link" to="/dev">/dev</Link> to switch or disable dev identity.
          </p>
        )}
        {source === 'google' && (
          <div className="form-actions" style={{ marginTop: '0.75rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logoutGoogle();
                navigate('/login', { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="section-title">Planner preferences</h2>
        {!user && (
          <Callout variant="error">Sign in to load planner preferences.</Callout>
        )}
        {loadingPrefs ? (
          <p>Loading…</p>
        ) : !user ? (
          <p className="form-hint">Planner preferences are available after authentication.</p>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label>Preferred start time</label>
                <input
                  type="time"
                  className="ui-input"
                  value={minutesToTime(form.studyWindowStartMin)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      studyWindowStartMin: timeToMinutes(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Preferred end time</label>
                <input
                  type="time"
                  className="ui-input"
                  value={minutesToTime(form.studyWindowEndMin)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      studyWindowEndMin: Math.max(timeToMinutes(e.target.value), prev.studyWindowStartMin + 1),
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Max session length (min)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className="ui-input"
                  value={form.maxSessionMin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maxSessionMin: Math.max(5, Math.min(180, parseInt(e.target.value, 10) || 45)),
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Break between sessions (min)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className="ui-input"
                  value={form.breakBetweenSessionsMin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      breakBetweenSessionsMin: Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)),
                    }))
                  }
                />
              </div>
              <div className="form-group form-group-wide">
                <label>Course priority weights (optional)</label>
                <textarea
                  className="ui-textarea"
                  value={weightsText}
                  onChange={(e) => setWeightsText(e.target.value)}
                  placeholder={'math=2\nhistory=1\nbiology=-1'}
                  style={{ minHeight: 120 }}
                />
                <small className="form-hint">
                  One course per line (`course=weight`). Range -5 to 5. Higher values schedule sooner.
                </small>
              </div>
            </div>
            <label className="toggle-row" style={{ marginBottom: '0.85rem' }}>
              <input
                type="checkbox"
                checked={form.avoidLateNight}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    avoidLateNight: e.target.checked,
                  }))
                }
              />
              <span>Avoid late-night sessions (after 11:00 PM)</span>
            </label>
            <div className="form-actions">
              <Button onClick={handleSavePreferences} disabled={savingPrefs}>
                {savingPrefs ? 'Saving…' : 'Save preferences'}
              </Button>
              {prefsSaved && <span className="form-hint">{prefsSaved}</span>}
            </div>
          </>
        )}
      </Card>

      {prefsError && (
        <Callout variant="error" onRetry={loadPreferences}>
          {prefsError}
        </Callout>
      )}

      {import.meta.env.DEV && (
        <Card>
          <h2 className="section-title">Dev</h2>
          <Button
            variant="secondary"
            disabled={cleanupRunning}
            onClick={async () => {
              setCleanupRunning(true);
              setCleanupResult(null);
              try {
                const response = await api.cleanupClosed(7);
                setCleanupResult(`Deleted ${response.deletedRequests} requests, ${response.deletedComments} comments`);
              } catch (e) {
                setCleanupResult(e instanceof Error ? e.message : 'Failed');
              } finally {
                setCleanupRunning(false);
              }
            }}
          >
            {cleanupRunning ? 'Running…' : 'Run cleanup now'}
          </Button>
          {cleanupResult && <p className="form-hint" style={{ marginTop: '0.5rem' }}>{cleanupResult}</p>}
        </Card>
      )}
    </div>
  );
}
