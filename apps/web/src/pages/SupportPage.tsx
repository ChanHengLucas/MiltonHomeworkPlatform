import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api, type HelpRequest } from '../api';
import { Button, Card, Callout } from '../components/ui';

export function SupportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    subject: '',
    urgency: 'med' as 'low' | 'med' | 'high',
  });
  const [filterSubject, setFilterSubject] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const prefilledTitle = searchParams.get('title');
  const prefilledLinkedId = searchParams.get('linkedAssignmentId');
  const isNew = searchParams.get('new') === 'true';

  useEffect(() => {
    if (isNew && prefilledTitle) {
      setCreateForm((f) => ({
        ...f,
        title: prefilledTitle,
        description: 'I need help with this assignment. Here are my questions:\n\n1.\n2.\n3.',
      }));
    }
  }, [isNew, prefilledTitle]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSubject, filterUrgency, filterStatus, showClosed]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listRequests({
        subject: filterSubject || undefined,
        urgency: filterUrgency || undefined,
        status: filterStatus || undefined,
        showClosed: showClosed || undefined,
      });
      setRequests(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load requests';
      setError(msg);
      console.error('[Planner] [API]', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!createForm.title.trim() || !createForm.description.trim() || !createForm.subject.trim()) {
      setError('Title, description, and subject are required');
      return;
    }
    try {
      setError(null);
      await api.createRequest({
        ...createForm,
        linkedAssignmentId: prefilledLinkedId || undefined,
      });
      setCreateForm({ title: '', description: '', subject: '', urgency: 'med' });
      console.log('[Planner][API] Created support request');
      load();
      navigate('/support');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create';
      setError(msg);
      console.error('[Planner] [API]', msg);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Support Hub</h1>
      <p className="page-subtitle">Ask for or offer academic help.</p>

      <Card>
        <h2 className="section-title">Create Request</h2>
        <div className="form-grid form-grid-wide">
          <div className="form-group form-group-wide">
            <label>Title</label>
            <input
              className="ui-input ui-input-large"
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brief summary of what you need"
            />
          </div>
          <div className="form-group form-group-wide">
            <label>Description</label>
            <textarea
              className="ui-textarea ui-textarea-large"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe your question in detail"
              style={{ minHeight: 140 }}
            />
            {createForm.description.length > 0 && (
              <small className="form-hint">{createForm.description.length} characters</small>
            )}
          </div>
          <div className="form-group">
            <label>Subject</label>
            <input
              className="ui-input"
              value={createForm.subject}
              onChange={(e) => setCreateForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Math, Biology"
            />
          </div>
          <div className="form-group">
            <label>Urgency</label>
            <select
              className="ui-select"
              value={createForm.urgency}
              onChange={(e) => setCreateForm((f) => ({ ...f, urgency: e.target.value as 'low' | 'med' | 'high' }))}
            >
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <Button onClick={handleCreate} className="btn-primary-large">
          Create Request
        </Button>
      </Card>

      <Card>
        <h2 className="section-title">Filter</h2>
        <div className="filter-row">
          <input
            className="ui-input"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            placeholder="Subject"
            style={{ maxWidth: 120 }}
          />
          <select
            className="ui-select"
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            style={{ maxWidth: 120 }}
          >
            <option value="">Any urgency</option>
            <option value="low">Low</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            className="ui-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ maxWidth: 120 }}
          >
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="closed">Closed</option>
          </select>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed
          </label>
        </div>
      </Card>

      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}

      <Card>
        <h2 className="section-title">Requests</h2>
        {loading ? (
          <p>Loading…</p>
        ) : requests.length === 0 ? (
          <p className="empty-state">No requests yet. Create one above.</p>
        ) : (
          <div className="request-cards">
            {requests.map((r) => (
              <div
                key={r.id}
                className="request-card"
                onClick={() => navigate(`/support/${r.id}`)}
              >
                <div className="request-card-title">{r.title}</div>
                <div className="request-card-meta">
                  {r.subject} · {r.urgency === 'med' ? 'Medium' : r.urgency.charAt(0).toUpperCase() + r.urgency.slice(1)} · {r.status}
                  {r.createdByEmail ? ` · ${r.createdByEmail}` : ''}
                  {r.linkedAssignmentId ? ' · Linked' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
