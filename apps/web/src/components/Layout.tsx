import { lazy, Suspense, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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

  const navItems = [
    { to: '/assignments', label: 'Assignments' },
    { to: '/plan', label: 'Plan' },
    { to: '/availability', label: 'Availability' },
    { to: '/support', label: 'Support' },
    ...(teacherEligible ? [{ to: '/teacher', label: 'Teacher' }] : []),
    ...(teacherEligible ? [{ to: '/insights', label: 'Insights' }] : []),
    { to: '/settings', label: 'Settings' },
    ...(import.meta.env.DEV ? [{ to: '/qa', label: 'QA' }] : []),
  ];

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
