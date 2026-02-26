import { useState, useEffect } from 'react';

import { api, type AvailabilityBlock } from '../api';
import { useAppState } from '../context/AppContext';
import { Button, Card, Callout } from '../components/ui';

const MINUTES_PER_DAY = 24 * 60;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toStartMin(dayIndex: number, hour: number, minute: number): number {
  return dayIndex * MINUTES_PER_DAY + hour * 60 + minute;
}

function fromStartMin(startMin: number): { dayIndex: number; hour: number; minute: number } {
  const dayIndex = Math.floor(startMin / MINUTES_PER_DAY);
  const remainder = startMin % MINUTES_PER_DAY;
  const hour = Math.floor(remainder / 60);
  const minute = remainder % 60;
  return { dayIndex, hour, minute };
}

function formatBlockTime(label: string, startMin: number, endMin: number): string {
  const start = fromStartMin(startMin);
  const end = fromStartMin(endMin);
  const d = new Date(2000, 0, 1, start.hour, start.minute);
  const e = new Date(2000, 0, 1, end.hour, end.minute);
  return `${label} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function AvailabilityPage() {
  const { calendarBusyBlocks, calendarBusyUpdatedAt, setCalendarBusyBlocks } = useAppState();
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('22:00');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listAvailability();
      setBlocks(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load availability';
      setError(msg);
      console.error('[Planner] [API]', msg);
    } finally {
      setLoading(false);
    }
  }

  function parseTimeStr(str: string): { hour: number; minute: number } {
    const [h, m] = str.split(':').map(Number);
    return { hour: h ?? 0, minute: m ?? 0 };
  }

  async function handleAdd() {
    const startParts = parseTimeStr(startTime);
    const endParts = parseTimeStr(endTime);
    const start = toStartMin(dayIndex, startParts.hour, startParts.minute);
    const end = toStartMin(dayIndex, endParts.hour, endParts.minute);
    if (end <= start) {
      setError('End time must be after start time');
      return;
    }
    try {
      setError(null);
      await api.createAvailability(start, end);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add block';
      setError(msg);
      console.error('[Planner] [API]', msg);
    }
  }

  async function handleImportBusy() {
    try {
      setImporting(true);
      setError(null);
      setImportResult(null);
      console.log('[Calendar] Importing busy times for next 7 days');
      const busy = await api.getCalendarBusy(7);
      setCalendarBusyBlocks(busy);
      setImportResult(`Imported ${busy.length} busy blocks from Google Calendar (cached up to 5 minutes).`);
      console.log('[Calendar] Busy import complete', { count: busy.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to import calendar';
      setError(msg);
      setImportResult(null);
      console.error('[Planner] [API]', msg);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteAvailability(id);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      setError(msg);
      console.error('[Planner] [API]', msg);
    }
  }

  const todayIndex = (new Date().getDay() + 6) % 7;
  const blocksByDay = DAYS.map((_, i) => ({
    day: i,
    label: DAYS[i],
    blocks: blocks.filter((b) => fromStartMin(b.startMin).dayIndex === i),
  }));

  return (
    <div className="page">
      <h1 className="page-title">Availability</h1>
      <p className="page-subtitle">Add times you are willing to work.</p>

      <Card>
        <div className="availability-form-row">
          <div className="form-group">
            <label>Day</label>
            <select
              className="ui-select"
              value={dayIndex}
              onChange={(e) => setDayIndex(parseInt(e.target.value, 10))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Start</label>
            <input
              type="time"
              className="ui-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>End</label>
            <input
              type="time"
              className="ui-input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <div className="form-group form-group-button">
            <Button onClick={handleAdd}>Add</Button>
          </div>
          <div className="form-group form-group-button">
            <Button variant="secondary" onClick={handleImportBusy} disabled={importing}>
              {importing ? 'Importing…' : 'Import busy times from Google Calendar'}
            </Button>
          </div>
        </div>
        {importResult && (
          <p className="form-hint" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
            {importResult}
          </p>
        )}
      </Card>

      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}

      <Card>
        <h2 className="section-title">Your availability</h2>
        {loading ? (
          <p>Loading…</p>
        ) : blocks.length === 0 ? (
          <p className="empty-state">Add blocks above to schedule study time.</p>
        ) : (
          <div className="availability-by-day">
            {blocksByDay.map(({ day, label, blocks: dayBlocks }) =>
              dayBlocks.length > 0 ? (
                <div key={day} className="availability-day-group">
                  <h3 className={`availability-day-title ${day === todayIndex ? 'today' : ''}`}>
                    {label}
                  </h3>
                  {dayBlocks.map((b) => (
                      <div key={b.id} className="availability-block-item">
                        <span>{formatBlockTime(label, b.startMin, b.endMin)}</span>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(b.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                </div>
              ) : null,
            )}
          </div>
        )}
      </Card>

      {calendarBusyBlocks.length > 0 && (
        <Card>
          <div className="split-header">
            <h2 className="section-title" style={{ marginBottom: 0 }}>Imported busy times</h2>
            {calendarBusyUpdatedAt && (
              <span className="form-hint">
                Last synced {new Date(calendarBusyUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="assignment-list" style={{ marginTop: '0.75rem' }}>
            {calendarBusyBlocks.slice(0, 12).map((busy, index) => (
              <div key={`${busy.startMs}-${busy.endMs}-${index}`} className="assignment-card">
                <div className="assignment-card-content">
                  <div className="assignment-card-title">Busy ({busy.source})</div>
                  <div className="assignment-card-meta">
                    {new Date(busy.startMs).toLocaleString()} · {new Date(busy.endMs).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {calendarBusyBlocks.length > 12 && (
            <p className="form-hint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              Showing 12 of {calendarBusyBlocks.length} blocks.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
