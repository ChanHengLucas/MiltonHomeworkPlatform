import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { DevIdentitySwitcher } from './DevIdentitySwitcher';

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
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {import.meta.env.DEV && <DevIdentitySwitcher />}
          {user && (
            <div className="user-menu" style={{ position: 'relative' }}>
              <button
                type="button"
                className="ui-btn btn-secondary btn-sm"
                onClick={() => setMenuOpen(!menuOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {user.picture ? (
                  <img src={user.picture} alt="" width={24} height={24} style={{ borderRadius: '50%' }} />
                ) : (
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                    {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </span>
                )}
                <span>{user.name || user.email}</span>
              </button>
              {menuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="ui-modal"
                    style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem', minWidth: 180, zIndex: 100 }}
                  >
                    <div className="ui-modal-body">
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>{user.email}</p>
                      <button
                        type="button"
                        className="ui-btn btn-secondary btn-sm"
                        style={{ marginTop: '0.5rem', width: '100%' }}
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
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
