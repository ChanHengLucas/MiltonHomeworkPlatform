import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

import {
  api,
  type HelpRequest,
  type HelpComment,
  type HelpRequestResource,
  type RequestActivityEntry,
} from '../api';
import { useAppState } from '../context/AppContext';
import { useAuthGate } from '../hooks/useAuthGate';
import { isTeacherEligible } from '../utils/identity';
import { Button, Card, Callout, Modal } from '../components/ui';

function urgencyLabel(u: string): string {
  return u === 'med' ? 'Medium' : u.charAt(0).toUpperCase() + u.slice(1);
}

function statusClass(value: string): string {
  if (value === 'claimed') return 'status-chip status-claimed';
  if (value === 'closed') return 'status-chip status-closed';
  return 'status-chip status-open';
}

export function SupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSignedIn } = useAuthGate();
  const { suggestedClaimName, schoolEmail } = useAppState();
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [comments, setComments] = useState<HelpComment[]>([]);
  const [resources, setResources] = useState<HelpRequestResource[]>([]);
  const [activity, setActivity] = useState<RequestActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmUnclaim, setConfirmUnclaim] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'spam' | 'trolling' | 'no_show' | 'other'>('no_show');
  const [reportDetails, setReportDetails] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [resourceNote, setResourceNote] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!id || !isSignedIn) return;
    try {
      setLoading(true);
      setError(null);
      setNotAvailable(false);
      const [req, cmts, act, resResources] = await Promise.all([
        api.getRequest(id),
        api.listComments(id),
        api.getRequestActivity(id),
        api.listRequestResources(id),
      ]);
      setRequest(req);
      setComments(cmts);
      setActivity(act);
      setResources(resResources);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 403) {
        setNotAvailable(true);
        setRequest(null);
        setComments([]);
        setResources([]);
        setActivity([]);
      } else {
        setError(err.message || 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, [id, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      setRequest(null);
      setComments([]);
      setResources([]);
      setActivity([]);
      setError(null);
      setNotAvailable(false);
      return;
    }
    load();
  }, [isSignedIn, load]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    setClaimName(suggestedClaimName);
  }, [suggestedClaimName]);

  async function handleClaim() {
    if (!isSignedIn) return;
    if (!id || !claimName.trim()) {
      setError('Enter your name to claim');
      return;
    }
    try {
      setActionLoading('claim');
      setError(null);
      setSuccess(null);
      await api.claimRequest(id, claimName.trim());
      setSuccess('Request claimed successfully');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim');
      setSuccess(null);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnclaim() {
    if (!isSignedIn) return;
    if (!id) return;
    try {
      setActionLoading('unclaim');
      setError(null);
      setConfirmUnclaim(false);
      await api.unclaimRequest(id);
      setSuccess('Claim released');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to release');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClose() {
    if (!isSignedIn) return;
    if (!id) return;
    try {
      setActionLoading('close');
      setError(null);
      await api.closeRequest(id);
      setSuccess('Request closed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddComment() {
    if (!isSignedIn) return;
    if (!id || !commentBody.trim()) return;
    try {
      setActionLoading('comment');
      setError(null);
      await api.addComment(id, commentBody.trim());
      setCommentBody('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add comment');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReport() {
    if (!isSignedIn) return;
    if (!id) return;
    try {
      setActionLoading('report');
      setError(null);
      await api.reportRequest(id, reportReason, reportDetails || undefined);
      setReportOpen(false);
      setReportReason('no_show');
      setReportDetails('');
      setSuccess('Report submitted');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to report');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddResourceLink() {
    if (!isSignedIn || !id) return;
    if (!resourceLink.trim()) {
      setError('Enter a valid resource link');
      return;
    }
    try {
      setActionLoading('resource-link');
      setError(null);
      await api.addRequestResourceLink(id, {
        url: resourceLink.trim(),
        note: resourceNote.trim() || null,
      });
      setResourceLink('');
      setResourceNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add resource link');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUploadResourceFile() {
    if (!isSignedIn || !id) return;
    if (!resourceFile) {
      setError('Choose a file to upload');
      return;
    }
    try {
      setActionLoading('resource-file');
      setError(null);
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read upload file'));
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Failed to process upload file'));
            return;
          }
          const base64 = reader.result.includes(',') ? reader.result.split(',')[1] : reader.result;
          resolve(base64);
        };
        reader.readAsDataURL(resourceFile);
      });
      await api.uploadRequestResourceFile(id, {
        fileName: resourceFile.name,
        mimeType: resourceFile.type || null,
        contentBase64,
        note: resourceNote.trim() || null,
      });
      setResourceFile(null);
      setResourceNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload resource file');
    } finally {
      setActionLoading(null);
    }
  }

  const isOwnRequest =
    request && schoolEmail && request.createdByEmail &&
    schoolEmail.toLowerCase().trim() === request.createdByEmail.toLowerCase().trim();

  const userEmail = (schoolEmail || '').toLowerCase().trim();
  const creatorEmail = (request?.createdByEmail || '').toLowerCase().trim();
  const claimerEmail = (request?.claimedByEmail || '').toLowerCase().trim();
  const isRequester = userEmail && creatorEmail && userEmail === creatorEmail;
  const isClaimer = userEmail && claimerEmail && userEmail === claimerEmail;
  const isTeacher = userEmail && isTeacherEligible(userEmail);
  const claimRestrictedToTeachers = request?.claimMode === 'teacher_only' && !isTeacher;
  const canClose = request && request.status !== 'closed' && (isRequester || isTeacher);
  const canUnclaim = request && request.status === 'claimed' && (isClaimer || isRequester || isTeacher);
  const canReport = request && request.status === 'claimed' && (isRequester || isTeacher);
  const requesterMailto = request?.createdByEmail
    ? `mailto:${encodeURIComponent(request.createdByEmail)}?subject=${encodeURIComponent(`Support request: ${request.title}`)}`
    : null;
  const helperMailto = request?.claimedByEmail
    ? `mailto:${encodeURIComponent(request.claimedByEmail)}?subject=${encodeURIComponent(`Support request: ${request.title}`)}`
    : null;

  if (!id) return null;
  if (loading) return <p>Loading…</p>;
  if (notAvailable) {
    return (
      <div className="page">
        <nav className="breadcrumb" style={{ marginBottom: '1rem' }}>
          <Link to="/support" className="link">Support</Link>
          <span className="breadcrumb-sep">/</span>
          <span>Request</span>
        </nav>
      <Card>
        <h2 className="section-title">Not available</h2>
        <p className="page-subtitle">
            This request is not visible to you. Claimed and closed requests are only visible to the requester, helper, or teachers.
        </p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/support" className="link">← Back to Support Hub</Link>
          </p>
        </Card>
      </div>
    );
  }
  if (!request) return <Callout variant="error">Request not found</Callout>;

  return (
    <div className="page">
      <nav className="breadcrumb" style={{ marginBottom: '1rem' }}>
        <Link to="/support" className="link">Support</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{request.title}</span>
      </nav>

      <Card>
        <div className="split-header">
          <h2 className="section-title" style={{ marginBottom: 0 }}>{request.title}</h2>
          <span className={statusClass(request.status)}>
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </span>
        </div>
        <div className="request-card-meta" style={{ marginBottom: '0.75rem' }}>
          <span>{request.subject}</span>
          <span>·</span>
          <span>{urgencyLabel(request.urgency)}</span>
          {request.createdByEmail && (
            <span style={{ display: 'block', marginTop: '0.25rem' }}>
              From: {request.createdByEmail}
            </span>
          )}
          {request.claimedBy ? (
            <span style={{ display: 'block', marginTop: '0.25rem' }}>
              Claimed by: {request.claimedBy}
            </span>
          ) : null}
        </div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{request.description}</p>

        {(request.meetingAbout || request.meetingLocation || request.meetingLink || request.proposedTimes) && (
          <div style={{ marginTop: '0.85rem' }}>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.98rem' }}>Meeting details</h3>
            {request.meetingAbout && <p style={{ margin: '0.15rem 0' }}><strong>For:</strong> {request.meetingAbout}</p>}
            {request.meetingLocation && <p style={{ margin: '0.15rem 0' }}><strong>Location:</strong> {request.meetingLocation}</p>}
            {request.meetingLink && (
              <p style={{ margin: '0.15rem 0' }}>
                <strong>Link:</strong>{' '}
                <a href={request.meetingLink} target="_blank" rel="noreferrer" className="link">
                  {request.meetingLink}
                </a>
              </p>
            )}
            {request.proposedTimes && (
              <p style={{ margin: '0.15rem 0', whiteSpace: 'pre-wrap' }}>
                <strong>Proposed times:</strong> {request.proposedTimes}
              </p>
            )}
          </div>
        )}

        {request.linkedAssignmentId && (
          <p style={{ marginTop: '0.75rem' }}>
            <Link to="/assignments" className="link">View linked assignment →</Link>
          </p>
        )}

        <div className="support-actions">
          {request.status === 'open' && (
            <>
              {isOwnRequest ? (
                <span className="form-hint">You can&apos;t claim your own request.</span>
              ) : claimRestrictedToTeachers ? (
                <span className="form-hint">This request is restricted to teacher/tutor claims.</span>
              ) : (
                <>
                  <input
                    className="ui-input"
                    placeholder="Your name"
                    value={claimName}
                    onChange={(e) => setClaimName(e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                  <Button onClick={handleClaim} disabled={!!actionLoading}>
                    {actionLoading === 'claim' ? 'Claiming…' : 'Claim request'}
                  </Button>
                </>
              )}
            </>
          )}
          {requesterMailto && (
            <a className="link" href={requesterMailto}>Email requester</a>
          )}
          {helperMailto && (
            <a className="link" href={helperMailto}>Email helper</a>
          )}
          {canUnclaim && (
            <Button
              variant="secondary"
              onClick={() => setConfirmUnclaim(true)}
              disabled={!!actionLoading}
            >
              {isClaimer ? 'Release claim' : isRequester ? 'Remove helper' : 'Release helper'}
            </Button>
          )}
          {canReport && (
            <Button variant="secondary" onClick={() => setReportOpen(true)} disabled={!!actionLoading}>
              Report helper
            </Button>
          )}
          {canClose && (
            <Button variant="secondary" onClick={handleClose} disabled={!!actionLoading}>
              {actionLoading === 'close' ? 'Closing…' : 'Close request'}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="section-title">Attachments & resources</h2>
        {resources.length === 0 ? (
          <p className="empty-state">No files or links attached yet.</p>
        ) : (
          <div className="assignment-list">
            {resources.map((resource) => (
              <div key={resource.id} className="assignment-card">
                <div className="assignment-card-content">
                  <div className="assignment-card-title">
                    {resource.label || resource.originalName || resource.url || 'Resource'}
                  </div>
                  <div className="assignment-card-meta">
                    {resource.kind === 'file' ? 'File' : 'Link'} · {new Date(resource.createdAt).toLocaleString()}
                    {resource.createdByEmail ? ` · ${resource.createdByEmail}` : ''}
                  </div>
                  {resource.note && (
                    <p style={{ margin: '0.35rem 0 0 0', whiteSpace: 'pre-wrap' }}>{resource.note}</p>
                  )}
                </div>
                <div className="assignment-card-actions">
                  {resource.url && (
                    <a className="link" href={resource.url} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  )}
                  {resource.kind === 'file' && resource.storedPath && (
                    <a
                      className="link"
                      href={`/api/uploads/support-resources/${resource.requestId}/${resource.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {resource.originalName || 'Download'} ({Math.round((resource.sizeBytes || 0) / 1024)} KB)
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {(request.status !== 'closed') && (
          <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem' }}>
            <div className="form-grid form-grid-wide">
              <div className="form-group form-group-wide">
                <label>Add link</label>
                <input
                  className="ui-input"
                  value={resourceLink}
                  onChange={(e) => setResourceLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="form-group form-group-wide">
                <label>Upload file</label>
                <input
                  type="file"
                  className="ui-input"
                  onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)}
                />
                {resourceFile && (
                  <small className="form-hint">
                    Selected: {resourceFile.name} ({Math.round(resourceFile.size / 1024)} KB)
                  </small>
                )}
              </div>
              <div className="form-group form-group-wide">
                <label>Note (optional)</label>
                <textarea
                  className="ui-textarea"
                  value={resourceNote}
                  onChange={(e) => setResourceNote(e.target.value)}
                  placeholder="Context for this attachment"
                  style={{ minHeight: 70 }}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button
                size="sm"
                onClick={handleAddResourceLink}
                disabled={!!actionLoading || !resourceLink.trim()}
              >
                {actionLoading === 'resource-link' ? 'Adding…' : 'Add link'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUploadResourceFile}
                disabled={!!actionLoading || !resourceFile}
              >
                {actionLoading === 'resource-file' ? 'Uploading…' : 'Upload file'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {activity.length > 0 && (
        <Card>
          <h2 className="section-title">Request activity</h2>
          <ul className="comment-list" style={{ marginBottom: 0 }}>
            {activity.map((a, i) => (
              <li key={i} className="comment-item">
                <span className="request-card-meta">
                  {a.type === 'created' && 'Created'}
                  {a.type === 'claimed' && `Claimed by ${a.label || a.byEmail || '?'}`}
                  {a.type === 'unclaimed' && 'Released'}
                  {a.type === 'closed' && 'Closed'}
                  {' · '}
                  {new Date(a.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="section-title">Comments</h2>
        {comments.length === 0 ? (
          <p className="empty-state">No comments yet.</p>
        ) : (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="comment-item">
                <div className="request-card-meta">
                  {c.authorDisplayName || c.authorLabel || 'Unknown'} ({c.authorLabel ? c.authorLabel.charAt(0).toUpperCase() + c.authorLabel.slice(1) : 'Other'}) · {new Date(c.createdAt).toLocaleString()}
                </div>
                <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0 0' }}>{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label>Add comment</label>
            <textarea
              className="ui-textarea"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Your message…"
              style={{ minHeight: 60 }}
            />
          </div>
          <Button onClick={handleAddComment} disabled={!commentBody.trim() || !!actionLoading}>
            {actionLoading === 'comment' ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </Card>

      <Modal isOpen={confirmUnclaim} onClose={() => setConfirmUnclaim(false)} title="Release claim?">
        <p>Are you sure you want to release this claim? The request will become open again for others to claim.</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setConfirmUnclaim(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleUnclaim} disabled={!!actionLoading}>
            {actionLoading === 'unclaim' ? 'Releasing…' : 'Release'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title="Report">
        <div className="form-group">
          <label>Reason</label>
          <select
            className="ui-select"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
          >
            <option value="spam">Spam</option>
            <option value="trolling">Trolling</option>
            <option value="no_show">No-show</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label>Details (optional)</label>
          <textarea
            className="ui-textarea"
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Additional context…"
            style={{ minHeight: 80 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button>
          <Button onClick={handleReport} disabled={!!actionLoading}>
            {actionLoading === 'report' ? 'Submitting…' : 'Submit report'}
          </Button>
        </div>
      </Modal>

      {success && (
        <Callout variant="success" onRetry={load}>
          {success}
        </Callout>
      )}
      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}
    </div>
  );
}
