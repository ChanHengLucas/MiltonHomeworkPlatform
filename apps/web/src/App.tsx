import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { CoursesPage } from './pages/CoursesPage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { PlanPage } from './pages/PlanPage';
import { SettingsPage } from './pages/SettingsPage';
import { SupportPage } from './pages/SupportPage';
import { SupportDetailPage } from './pages/SupportDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import { LoginPage } from './pages/LoginPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';
import { NotificationsPage } from './pages/NotificationsPage';

import './App.css';

const DevQAPage = import.meta.env.DEV
  ? lazy(() => import('./pages/QAPage').then((m) => ({ default: m.QAPage })))
  : null;

const DevToolsPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DevPage').then((m) => ({ default: m.DevPage })))
  : null;

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/assignments" replace />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="assignments" element={<AssignmentsPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="plan" element={<PlanPage />} />
              <Route path="availability" element={<AvailabilityPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="support/:id" element={<SupportDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="teacher" element={<TeacherDashboardPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {DevToolsPage && (
                <Route
                  path="dev"
                  element={(
                    <Suspense fallback={<p>Loading…</p>}>
                      <DevToolsPage />
                    </Suspense>
                  )}
                />
              )}
              {DevQAPage && (
                <Route
                  path="qa"
                  element={(
                    <Suspense fallback={<p>Loading…</p>}>
                      <DevQAPage />
                    </Suspense>
                  )}
                />
              )}
            </Route>
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
