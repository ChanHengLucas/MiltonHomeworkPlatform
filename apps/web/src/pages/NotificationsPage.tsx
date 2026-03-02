import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type NotificationRecord } from '../api';
import { Button, Card, Callout } from '../components/ui';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getDestination(notification: NotificationRecord): string {
  const payload = notification.payload || {};
  const requestId = asString(payload.requestId);
  if (requestId) return `/support/${requestId}`;
  if (notification.type === 'assignment_posted' || notification.type.startsWith('due_reminder_')) return '/courses';
  return '/support';
}

function getMessage(notification: NotificationRecord): string {
  const payload = notification.payload || {};
  const title = asString(payload.title) || 'Untitled';
  const courseName = asString(payload.courseName);
  const byName = asString(payload.byName) || asString(payload.byEmail);

  switch (notification.type) {
    case 'assignment_posted':
      return `New assignment posted${courseName ? ` in ${courseName}` : ''}: ${title}`;
    case 'request_claimed':
      return `${title} was claimed${byName ? ` by ${byName}` : ''}.`;
    case 'request_unclaimed':
      return `${title} was released and is open again.`;
    case 'request_closed':
      return `${title} was closed.`;
    case 'request_comment':
      return `${title} has a new comment${byName ? ` from ${byName}` : ''}.`;
    case 'due_reminder_24h':
      return `Due in 24 hours${courseName ? ` (${courseName})` : ''}: ${title}`;
    case 'due_reminder_6h':
      return `Due in 6 hours${courseName ? ` (${courseName})` : ''}: ${title}`;
    default:
      return title;
  }
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const list = await api.listNotifications(100);
      setNotifications(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    try {
      setUpdating(true);
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark notification as read');
    } finally {
      setUpdating(false);
    }
  }

  async function markAllRead() {
    try {
      setUpdating(true);
      await api.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark notifications as read');
    } finally {
      setUpdating(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="page">
      <div className="split-header">
        <h1 className="page-title">Notifications</h1>
        <Button variant="secondary" size="sm" onClick={markAllRead} disabled={updating || unreadCount === 0}>
          Mark all read
        </Button>
      </div>
      <p className="page-subtitle">
        Assignment posts, support updates, and due reminders.
      </p>

      {error && <Callout variant="error">{error}</Callout>}

      <Card>
        {loading ? (
          <p>Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="empty-state">No notifications yet.</p>
        ) : (
          <div className="assignment-list">
            {notifications.map((notification) => (
              <div key={notification.id} className={`assignment-card ${notification.readAt ? '' : 'notification-unread'}`}>
                <div className="assignment-card-content">
                  <div className="split-header">
                    <div className="assignment-card-title">
                      {getMessage(notification)}
                    </div>
                    {!notification.readAt && <span className="status-chip status-open">Unread</span>}
                  </div>
                  <div className="assignment-card-meta">
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                  <p style={{ margin: '0.35rem 0 0 0' }}>
                    <Link className="link" to={getDestination(notification)}>
                      Open related item
                    </Link>
                  </p>
                </div>
                <div className="assignment-card-actions">
                  {!notification.readAt && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => markRead(notification.id)}
                      disabled={updating}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
