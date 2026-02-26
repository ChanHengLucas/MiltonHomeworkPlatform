import { useAppState } from '../context/AppContext';

const PRESETS = [
  { id: 'student-a', email: 'lucas12@milton.edu', name: 'Lucas Chan', label: 'Student A' },
  { id: 'student-b', email: 'test34@milton.edu', name: 'Test Student', label: 'Student B' },
  { id: 'teacher', email: 'hales@milton.edu', name: 'Mr. Hales', label: 'Teacher' },
] as const;

export function DevIdentitySwitcher() {
  const { schoolEmail, setSchoolEmail, displayName, setDisplayName } = useAppState();

  if (import.meta.env.PROD) return null;

  const currentPreset = PRESETS.find((p) => p.email === schoolEmail);
  const presetId = currentPreset?.id ?? 'custom';

  return (
    <div className="dev-identity-switcher">
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
    </div>
  );
}
