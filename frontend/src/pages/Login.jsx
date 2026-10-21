import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, Shield, Lock, ArrowRight, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export function Login() {
  const { loginWithGoogle, loginWithAdminCredentials } = useAuth();
  const navigate = useNavigate();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const redirectByRole = (user) => {
    if (user.role === 'STUDENT') {
      if (user.needsProfile) navigate('/complete-profile');
      else navigate('/student');
    } else if (user.role === 'STAFF') {
      navigate('/staff');
    } else if (user.role === 'FACULTY') {
      navigate('/faculty');
    } else if (user.role === 'ADMIN') {
      navigate('/admin');
    }
  };

  const handleGoogleSuccess = async (response) => {
    try {
      const user = await loginWithGoogle(response.credential);
      redirectByRole(user);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminLoading(true);
    try {
      const user = await loginWithAdminCredentials(adminEmail, adminPassword);
      setIsAdminModalOpen(false);
      redirectByRole(user);
    } catch (err) {
      console.error(err);
    }
    setAdminLoading(false);
  };

  // Demo shortcut login helper for convenient testing
  const handleQuickDemo = async (roleEmail, name, role) => {
    try {
      // Craft test payload encoded as dev JWT for local testing
      const fakeToken = btoa(JSON.stringify({ alg: 'none' })) + '.' +
        btoa(JSON.stringify({
          sub: '100',
          email: roleEmail,
          name: name,
          email_verified: true
        })) + '.signature';

      const user = await loginWithGoogle(fakeToken);
      redirectByRole(user);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-500 shadow-xl shadow-brand-500/20 mb-4">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white font-sans">
          CampusFind
        </h2>
        <p className="mt-2 text-sm text-slate-300 font-medium">
          Digital Lost & Found Management System · SJT Block
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-white/20 sm:px-10">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 text-center mb-4">
                Sign in with VIT Institutional Google Account
              </label>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google Sign-In failed')}
                  useOneTap
                  theme="outline"
                  shape="pill"
                  size="large"
                />
              </div>

              <p className="text-[11px] text-slate-400 text-center mt-3">
                Students (<span className="text-slate-600 font-medium">@vitstudent.ac.in</span>) & Staff (<span className="text-slate-600 font-medium">@vit.ac.in</span>)
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium">Quick Demo Testing</span>
              </div>
            </div>

            {/* Quick Demo Logins for Pair Programming / Reviewers */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemo('aarav.patel2023@vitstudent.ac.in', 'Aarav Patel (Student)', 'STUDENT')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 font-semibold text-slate-700 text-left transition flex items-center justify-between"
              >
                <span>Student</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('staff@vit.ac.in', 'Desk Staff', 'STAFF')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 font-semibold text-slate-700 text-left transition flex items-center justify-between"
              >
                <span>Staff (SJT)</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('rajesh.faculty@vit.ac.in', 'Prof. Rajesh Kumar', 'FACULTY')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 font-semibold text-slate-700 text-left transition flex items-center justify-between"
              >
                <span>Faculty</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('admin@vit.ac.in', 'CampusFind Admin', 'ADMIN')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 font-semibold text-slate-700 text-left transition flex items-center justify-between"
              >
                <span>Admin</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Emergency Break-Glass Admin Login
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Break-glass Admin Login Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Admin Break-Glass</h3>
                <p className="text-xs text-slate-500">Emergency backup credentials</p>
              </div>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@vit.ac.in"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {adminLoading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
