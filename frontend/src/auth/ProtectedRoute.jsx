import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ShieldAlert } from 'lucide-react';

export function ProtectedRoute({ children, roles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect student to complete registration if needed
  if (user?.role === 'STUDENT' && user?.needsProfile && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  // Role authorization
  if (roles && !roles.includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted (403)</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Your account role (<span className="font-semibold text-slate-800">{user?.role}</span>) does not have permission to view this page.
          </p>
          <a
            href={
              user?.role === 'STUDENT'
                ? '/student'
                : user?.role === 'STAFF'
                ? '/staff'
                : user?.role === 'FACULTY'
                ? '/faculty'
                : '/admin'
            }
            className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition text-sm shadow-sm"
          >
            Go to Your Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}
