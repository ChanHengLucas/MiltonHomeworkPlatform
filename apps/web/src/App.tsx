import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { PlanPage } from './pages/PlanPage';
import { SettingsPage } from './pages/SettingsPage';
import { SupportPage } from './pages/SupportPage';
import { SupportDetailPage } from './pages/SupportDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import { LoginPage } from './pages/LoginPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';

import './App.css';

const DevQAPage = import.meta.env.DEV
  ? lazy(() => import('./pages/QAPage').then((m) => ({ default: m.QAPage })))
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
              <Route path="plan" element={<PlanPage />} />
              <Route path="availability" element={<AvailabilityPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="support/:id" element={<SupportDetailPage />} />
              <Route path="teacher" element={<TeacherDashboardPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="settings" element={<SettingsPage />} />
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
