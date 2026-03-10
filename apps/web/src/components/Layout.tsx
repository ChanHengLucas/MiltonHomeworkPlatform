import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet, NavLink } from 'react-router-dom';
import { api, type NotificationRecord } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../context/AppContext';
import { useIdentity } from '../hooks/useIdentity';

export function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clearDevIdentity, refetchGoogleIdentity } = useIdentity();
  const { teacherEligible, displayName, identitySource } = useAppState();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const navItems = [
    { to: '/assignments', label: 'Assignments' },
    { to: '/courses', label: 'Courses' },
    { to: '/plan', label: 'Plan' },
    { to: '/availability', label: 'Availability' },
    { to: '/support', label: 'Support' },
    ...(teacherEligible ? [{ to: '/teacher/homework', label: 'Dashboard' }] : []),
    ...(teacherEligible ? [{ to: '/insights', label: 'Insights' }] : []),
    { to: '/settings', label: 'Settings' },
  ];

  const identityBadge = useMemo(() => {
    if (identitySource === 'dev') return 'DEV MODE (no Google)';
    if (identitySource === 'google') return 'Google';
    return '';
  }, [identitySource]);

  const checkApiHealth = useCallback(async (): Promise<boolean> => {
    try {
      await api.getApiHealth();
      setApiOnline(true);
      return true;
    } catch {
      setApiOnline(false);
      return false;
    }
  }, []);

  function getNotificationErrorMessage(error: unknown): string {
    if (apiOnline === false) return 'API offline';
    if (error instanceof Error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
        return 'API offline';
      }
      const status = (error as Error & { status?: number }).status;
      if (status === 404) {
        return 'Notifications endpoint not found (check API route/proxy)';
      }
      if (status === 502 || status === 503) {
        return 'API offline';
      }
      return error.message;
    }
    return 'Failed to load notifications';
  }

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setApiOnline(null);
      return;
    }
    try {
      if (!(await checkApiHealth())) {
        setUnreadCount(0);
        return;
      }
      const result = await api.getUnreadNotificationCount();
      setUnreadCount(result.count);
    } catch {
      setUnreadCount(0);
    }
  }, [checkApiHealth, user]);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotificationsError('Sign in to view notifications.');
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }
    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      if (!(await checkApiHealth())) {
        setNotificationsError('API offline');
        setNotifications([]);
        return;
      }
      const list = await api.listNotifications(8);
      setNotifications(list);
      setUnreadCount(list.filter((item) => !item.readAt).length);
    } catch (e) {
      const healthy = await checkApiHealth();
      setNotificationsError(healthy ? getNotificationErrorMessage(e) : 'API offline');
    } finally {
      setNotificationsLoading(false);
    }
  }, [checkApiHealth, apiOnline, user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setNotificationsOpen(false);
      return;
    }
    loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 30000);
    return () => window.clearInterval(timer);
  }, [loadUnreadCount, user]);

  async function handleToggleNotifications() {
    if (!user) {
      setNotificationsOpen(true);
      setNotificationsError('Sign in to view notifications.');
      setNotifications([]);
      return;
    }
    if (!notificationsOpen) {
      await loadNotifications();
    }
    setNotificationsOpen((open) => !open);
  }

  async function handleSignOut() {
    if (identitySource === 'dev') {
      clearDevIdentity();
      await refetchGoogleIdentity();
      navigate('/login', { replace: true });
      return;
    }
    await logout();
    navigate('/login', { replace: true });
  }

  async function markNotificationRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore panel-level failures
    }
  }

  function messageForNotification(notification: NotificationRecord): string {
    const payload = notification.payload || {};
    const title = typeof payload.title === 'string' ? payload.title : 'Update';
    const courseName = typeof payload.courseName === 'string' ? payload.courseName : '';
    switch (notification.type) {
      case 'assignment_posted':
        return `New assignment${courseName ? ` in ${courseName}` : ''}: ${title}`;
      case 'request_claimed':
        return `${title} was claimed`;
      case 'request_unclaimed':
        return `${title} was released`;
      case 'request_closed':
        return `${title} was closed`;
      case 'request_comment':
        return `${title} has a new comment`;
      case 'due_reminder_24h':
        return `Due in 24h: ${title}`;
      case 'due_reminder_6h':
        return `Due in 6h: ${title}`;
      default:
        return title;
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="shell-header-inner">
          <div className="header-left">
            <NavLink to="/assignments" className="header-logo">
              <span className="header-logo-milton">Milton</span> Planner
            </NavLink>
            <nav className="nav">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to !== '/support'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="header-right">
            {identityBadge && (
              <div className="signed-in-pill" title={identitySource === 'dev' ? 'Dev mode identity' : 'Google account'}>
                <span className="signed-in-text">Signed in as {displayName || 'User'}</span>
                <span className={`identity-badge ${identitySource === 'dev' ? 'identity-badge-dev' : ''}`}>
                  {identityBadge}
                </span>
              </div>
            )}
            <button
              type="button"
              className="ui-btn btn-secondary btn-sm notification-trigger"
              onClick={handleToggleNotifications}
              aria-label="Notifications"
              disabled={!user}
            >
              <span>Notifications</span>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            <button
              type="button"
              className="ui-btn btn-secondary btn-sm"
              onClick={handleSignOut}
            >
              Log out
            </button>
            {notificationsOpen && (
              <div className="notifications-panel ui-modal">
                <div className="ui-modal-body">
                  <div className="split-header">
                    <strong>Notifications</strong>
                    <NavLink to="/notifications" className="link" onClick={() => setNotificationsOpen(false)}>
                      View all
                    </NavLink>
                  </div>
                  {notificationsLoading ? (
                    <p style={{ margin: '0.5rem 0 0 0' }}>Loading…</p>
                  ) : notificationsError ? (
                    <p className="form-hint" style={{ marginTop: '0.5rem' }}>{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="form-hint" style={{ marginTop: '0.5rem' }}>No notifications yet.</p>
                  ) : (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <div key={notification.id} className={`notification-item ${notification.readAt ? '' : 'unread'}`}>
                          <div className="notification-item-text">
                            <div>{messageForNotification(notification)}</div>
                            <div className="assignment-card-meta">{new Date(notification.createdAt).toLocaleString()}</div>
                          </div>
                          {!notification.readAt && (
                            <button
                              type="button"
                              className="ui-btn btn-secondary btn-sm"
                              onClick={() => markNotificationRead(notification.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {apiOnline === false && (
        <div className="api-offline-banner">
          API offline or proxy misconfigured. Check that <code>/api</code> is routed to the API server.
        </div>
      )}
      <main className="main">
        <div className="main-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
