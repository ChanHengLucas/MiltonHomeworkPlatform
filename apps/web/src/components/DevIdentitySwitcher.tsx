import { useAppState } from '../context/AppContext';
import { useIdentity } from '../hooks/useIdentity';

const PRESETS = [
  { id: 'student-a', email: 'lucas_chan26@milton.edu', name: 'Lucas Chan', label: 'Student A' },
  { id: 'student-b', email: 'jane_doe27@milton.edu', name: 'Jane Doe', label: 'Student B' },
  { id: 'teacher', email: 'john_smith@milton.edu', name: 'John Smith', label: 'Teacher' },
] as const;

export function DevIdentitySwitcher() {
  const { schoolEmail, setSchoolEmail, displayName, setDisplayName, identitySource } = useAppState();
  const { devModeAvailable } = useIdentity();

  if (import.meta.env.PROD) return null;

  if (!devModeAvailable) {
    return (
      <p className="form-hint" style={{ margin: 0 }}>
        Google auth mode is active. Dev identity is disabled.
      </p>
    );
  }

  const currentPreset = PRESETS.find((p) => p.email === schoolEmail);
  const presetId = currentPreset?.id ?? 'custom';

  return (
    <div className="dev-identity-switcher">
      <p className="form-hint" style={{ margin: 0 }}>
        {identitySource === 'dev'
          ? 'Dev mode identity is active (not Google).'
          : 'Google/session identity is active. Select a preset to override with dev identity.'}
      </p>
      <label className="dev-identity-label">
        <span>Dev Identity:</span>
        <select
          className="ui-select dev-identity-select"
          value={presetId}
          onChange={(e) => {
            const id = e.target.value;
            const preset = PRESETS.find((p) => p.id === id);
            if (preset) {
              setSchoolEmail(preset.email);
              setDisplayName(preset.name);
            }
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>
      {presetId === 'custom' && (
        <div className="dev-identity-custom">
          <input
            className="ui-input"
            type="email"
            placeholder="Email"
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
            style={{ width: 180 }}
          />
          <input
            className="ui-input"
            placeholder="Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: 120 }}
          />
        </div>
      )}
      {presetId !== 'custom' && (
        <span className="dev-identity-current">
          {schoolEmail || '(none)'}
        </span>
      )}
      <button
        type="button"
        className="ui-btn btn-secondary btn-sm"
        onClick={() => {
          setSchoolEmail('');
          setDisplayName('');
        }}
      >
        Disable Dev Identity
      </button>
    </div>
  );
}
