import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { api, type NotificationRecord } from '../api';
import { useAppState } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const DevIdentitySwitcher = import.meta.env.DEV
  ? lazy(() => import('./DevIdentitySwitcher').then((m) => ({ default: m.DevIdentitySwitcher })))
  : null;

export function Layout() {
  const { teacherEligible } = useAppState();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { to: '/assignments', label: 'Assignments' },
    { to: '/courses', label: 'Courses' },
    { to: '/plan', label: 'Plan' },
    { to: '/availability', label: 'Availability' },
    { to: '/support', label: 'Support' },
    { to: '/notifications', label: 'Notifications' },
    ...(teacherEligible ? [{ to: '/teacher', label: 'Teacher' }] : []),
    ...(teacherEligible ? [{ to: '/insights', label: 'Insights' }] : []),
    { to: '/settings', label: 'Settings' },
    ...(import.meta.env.DEV ? [{ to: '/qa', label: 'QA' }] : []),
  ];

  const loadUnreadCount = useCallback(async () => {
    try {
      const result = await api.getUnreadNotificationCount();
      setUnreadCount(result.count);
    } catch {
      // keep UI usable even if notifications fail
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const list = await api.listNotifications(8);
      setNotifications(list);
      setUnreadCount(list.filter((item) => !item.readAt).length);
    } catch (e) {
      setNotificationsError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 30000);
    return () => window.clearInterval(timer);
  }, [loadUnreadCount]);

  async function handleToggleNotifications() {
    if (!notificationsOpen) {
      await loadNotifications();
    }
    setNotificationsOpen((open) => !open);
    setMenuOpen(false);
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
              Academic Planner
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
            <button
              type="button"
              className="ui-btn btn-secondary btn-sm notification-trigger"
              onClick={handleToggleNotifications}
              aria-label="Notifications"
            >
              <span>Notifications</span>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
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
            {DevIdentitySwitcher && (
              <Suspense fallback={null}>
                <DevIdentitySwitcher />
              </Suspense>
            )}
            {user && (
              <div className="user-menu">
                <button
                  type="button"
                  className="ui-btn btn-secondary btn-sm user-menu-trigger"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {user.picture ? (
                    <img src={user.picture} alt="" width={24} height={24} className="user-avatar" />
                  ) : (
                    <span className="user-avatar user-avatar-fallback">
                      {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </span>
                  )}
                  <span>{user.name || user.email}</span>
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="user-menu-backdrop"
                      onClick={() => setMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="ui-modal user-menu-popup">
                      <div className="ui-modal-body">
                        <p className="user-menu-email">{user.email}</p>
                        <button
                          type="button"
                          className="ui-btn btn-secondary btn-sm user-menu-signout"
                          onClick={async () => {
                            await logout();
                            setMenuOpen(false);
                            setNotificationsOpen(false);
                            navigate('/login');
                          }}
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        <div className="main-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
