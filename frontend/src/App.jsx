import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Public & Auth Pages
import { Login } from './pages/Login';
import { CompleteProfile } from './pages/CompleteProfile';
import { VerifyLetter } from './pages/VerifyLetter';
import { NotFound } from './pages/NotFound';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { NewReport } from './pages/student/NewReport';
import { MyReports } from './pages/student/MyReports';
import { ReportDetail } from './pages/student/ReportDetail';

// Staff Pages
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { NewFoundItem } from './pages/staff/NewFoundItem';
import { FoundItemsList } from './pages/staff/FoundItemsList';
import { NotFoundCases } from './pages/staff/NotFoundCases';
import { RecordRoomVisit } from './pages/staff/RecordRoomVisit';

// Faculty Pages
import { FacultyQueue } from './pages/faculty/FacultyQueue';
import { CaseDetail } from './pages/faculty/CaseDetail';
import { TheftCases } from './pages/faculty/TheftCases';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersHierarchy } from './pages/admin/UsersHierarchy';
import { HierarchyTree } from './pages/admin/HierarchyTree';
import { AllReports } from './pages/admin/AllReports';
import { OverdueCases } from './pages/admin/OverdueCases';
import { SystemSettings } from './pages/admin/SystemSettings';
import { AuditLogs } from './pages/admin/AuditLogs';

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  switch (user?.role) {
    case 'STUDENT':
      return user.needsProfile ? <Navigate to="/complete-profile" replace /> : <Navigate to="/student" replace />;
    case 'STAFF':
      return <Navigate to="/staff" replace />;
    case 'FACULTY':
      return <Navigate to="/faculty" replace />;
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:code" element={<VerifyLetter />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* Protected Dashboard Routes Wrapped in Layout */}
        <Route element={<Layout />}>
          {/* Student */}
          <Route
            path="/student"
            element={
              <ProtectedRoute roles={['STUDENT']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/report-new"
            element={
              <ProtectedRoute roles={['STUDENT']}>
                <NewReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/reports"
            element={
              <ProtectedRoute roles={['STUDENT']}>
                <MyReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/reports/:id"
            element={
              <ProtectedRoute roles={['STUDENT']}>
                <ReportDetail />
              </ProtectedRoute>
            }
          />

          {/* Staff */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute roles={['STAFF', 'ADMIN']}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/items/new"
            element={
              <ProtectedRoute roles={['STAFF', 'ADMIN']}>
                <NewFoundItem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/items"
            element={
              <ProtectedRoute roles={['STAFF', 'ADMIN']}>
                <FoundItemsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/not-found"
            element={
              <ProtectedRoute roles={['STAFF', 'ADMIN']}>
                <NotFoundCases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/visits/new"
            element={
              <ProtectedRoute roles={['STAFF', 'ADMIN']}>
                <RecordRoomVisit />
              </ProtectedRoute>
            }
          />

          {/* Faculty */}
          <Route
            path="/faculty"
            element={
              <ProtectedRoute roles={['FACULTY', 'ADMIN']}>
                <FacultyQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/cases/:id"
            element={
              <ProtectedRoute roles={['FACULTY', 'ADMIN']}>
                <CaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/theft"
            element={
              <ProtectedRoute roles={['FACULTY', 'ADMIN']}>
                <TheftCases />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <UsersHierarchy />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hierarchy"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <HierarchyTree />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AllReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/overdue"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <OverdueCases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <SystemSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
