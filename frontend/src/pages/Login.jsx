import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  Sparkles,
  Shield,
  Lock,
  GraduationCap,
  Briefcase,
  ArrowRight,
  UserPlus,
  LogIn,
  KeyRound,
  Mail,
  User,
  Hash
} from 'lucide-react';
import toast from 'react-hot-toast';

export function Login() {
  const { loginStudentUser, registerStudentUser, loginStaffUser, loginWithAdminCredentials } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'student' or 'staff'
  const [activeTab, setActiveTab] = useState('student');

  // Student Form State
  const [isStudentRegister, setIsStudentRegister] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentFullName, setStudentFullName] = useState('');
  const [studentRegNo, setStudentRegNo] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);

  // Staff Form State
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  // Break-glass Admin Modal State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@vit.ac.in');
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

  // Handle Student Login / Auto-Signup
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setStudentLoading(true);

    const emailTrim = studentEmail.trim().toLowerCase();
    if (!emailTrim.endsWith('@vitstudent.ac.in')) {
      toast.error('Student email must end with @vitstudent.ac.in');
      setStudentLoading(false);
      return;
    }

    try {
      if (isStudentRegister) {
        if (!studentFullName.trim() || !studentRegNo.trim()) {
          toast.error('Full Name and Registration Number are required for registration');
          setStudentLoading(false);
          return;
        }

        const user = await registerStudentUser({
          email: emailTrim,
          password: studentPassword,
          fullName: studentFullName.trim(),
          regNo: studentRegNo.trim().toUpperCase()
        });
        redirectByRole(user);
      } else {
        // Sign In attempt (if account doesn't exist, can auto-create if name/reg given, or prompt)
        const user = await loginStudentUser(
          emailTrim,
          studentPassword,
          studentFullName.trim() || undefined,
          studentRegNo.trim() || undefined
        );
        redirectByRole(user);
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message;
      if (msg?.toLowerCase().includes('not found') || err.response?.status === 404) {
        setIsStudentRegister(true);
        toast('No account found. Enter your Name and Reg No to create your account!', {
          icon: '📝',
          duration: 5000
        });
      }
    } finally {
      setStudentLoading(false);
    }
  };

  // Handle Staff / Faculty Login
  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setStaffLoading(true);

    const emailTrim = staffEmail.trim().toLowerCase();
    try {
      const user = await loginStaffUser(emailTrim, staffPassword);
      redirectByRole(user);
    } catch (err) {
      console.error(err);
    } finally {
      setStaffLoading(false);
    }
  };

  // Handle Break-glass Admin Submit
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminLoading(true);
    try {
      const user = await loginWithAdminCredentials(adminEmail.trim().toLowerCase(), adminPassword);
      setIsAdminModalOpen(false);
      redirectByRole(user);
    } catch (err) {
      console.error(err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Quick Demo Shortcut Filler for Evaluation
  const fillQuickDemo = (email, password, type) => {
    if (type === 'student') {
      setActiveTab('student');
      setIsStudentRegister(false);
      setStudentEmail(email);
      setStudentPassword(password);
    } else if (type === 'staff') {
      setActiveTab('staff');
      setStaffEmail(email);
      setStaffPassword(password);
    } else if (type === 'admin') {
      setIsAdminModalOpen(true);
      setAdminEmail(email);
      setAdminPassword(password);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
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
          
          {/* Top Tab Switcher: 2 Main Logins */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              className={`flex items-center justify-center py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'student'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4 mr-1.5" />
              Student Portal
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`flex items-center justify-center py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'staff'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Briefcase className="w-4 h-4 mr-1.5" />
              Staff & Faculty
            </button>
          </div>

          {/* TAB 1: STUDENT LOGIN & AUTO-REGISTRATION */}
          {activeTab === 'student' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {isStudentRegister ? 'Create Student Account' : 'Student Sign In'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isStudentRegister
                      ? 'Register your official @vitstudent.ac.in account'
                      : 'Login with your institutional student credentials'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsStudentRegister(!isStudentRegister)}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-700 underline"
                >
                  {isStudentRegister ? 'Have an account? Sign in' : 'New student? Register'}
                </button>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-3.5">
                {isStudentRegister && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={studentFullName}
                          onChange={(e) => setStudentFullName(e.target.value)}
                          placeholder="e.g. Aarav Patel"
                          className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Number</label>
                      <div className="relative">
                        <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={studentRegNo}
                          onChange={(e) => setStudentRegNo(e.target.value)}
                          placeholder="e.g. 23BCE1042"
                          className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">VIT Student Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="name.branch2024@vitstudent.ac.in"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must end with <code className="text-slate-600">@vitstudent.ac.in</code>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={studentLoading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-md shadow-brand-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {studentLoading ? (
                    <span>Processing...</span>
                  ) : isStudentRegister ? (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Account & Sign In</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In as Student</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: STAFF & FACULTY LOGIN */}
          {activeTab === 'staff' && (
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800">Staff & Faculty Portal</h3>
                <p className="text-[11px] text-slate-500">
                  Authorized sign-in for SJT Desk Staff, Faculty, and HOD
                </p>
              </div>

              <form onSubmit={handleStaffSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="e.g. staff@vit.ac.in or faculty@vit.ac.in"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={staffLoading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 shadow-md shadow-indigo-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {staffLoading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In to Staff / Faculty Portal</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 text-center mt-2">
                  Faculty accounts are provisioned by the HOD (<span className="text-slate-600 font-medium">admin@vit.ac.in</span>).
                </p>
              </form>
            </div>
          )}

          {/* Quick Demo Pre-filled Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1-Click Demo Accounts
              </span>
              <span className="text-[10px] text-slate-400">Click to fill</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => fillQuickDemo('aarav.patel2023@vitstudent.ac.in', 'student123', 'student')}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-700 block text-[11px]">Student</span>
                  <span className="text-[10px] text-slate-400">Aarav Patel</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickDemo('staff@vit.ac.in', 'staff123', 'staff')}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-700 block text-[11px]">SJT Staff</span>
                  <span className="text-[10px] text-slate-400">Desk Staff</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickDemo('rajesh.faculty@vit.ac.in', 'faculty123', 'staff')}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-700 block text-[11px]">Faculty</span>
                  <span className="text-[10px] text-slate-400">Prof. Rajesh</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickDemo('admin@vit.ac.in', 'admin123', 'admin')}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-700 block text-[11px]">HOD / Admin</span>
                  <span className="text-[10px] text-slate-400">Dr. Admin (HOD)</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Emergency Break-Glass Admin Trigger */}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Emergency Break-Glass Admin Login
            </button>
          </div>
        </div>
      </div>

      {/* Break-glass Admin Login Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Admin Break-Glass</h3>
                <p className="text-xs text-slate-500">Emergency HOD / Administrator Access</p>
              </div>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@vit.ac.in"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
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
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
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
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {adminLoading ? 'Authenticating...' : 'Sign In as Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
