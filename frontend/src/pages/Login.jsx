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
  Hash,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Reusable input field.
 * Defined OUTSIDE Login so it isn't re-created on every render
 * (which would make inputs lose focus while typing).
 */
function Field({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  autoComplete,
  accent = 'brand',
  id
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  const focusRing =
    accent === 'indigo'
      ? 'focus:border-indigo-500 focus:ring-indigo-500/20'
      : accent === 'rose'
        ? 'focus:border-rose-500 focus:ring-rose-500/20'
        : 'focus:border-brand-500 focus:ring-brand-500/20';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full h-12 ${Icon ? 'pl-11' : 'pl-4'} ${isPassword ? 'pr-12' : 'pr-4'
            } rounded-xl border border-slate-300 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-4 ${focusRing} hover:border-slate-400`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            {show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}

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

  const demoBtn =
    'p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition flex items-center justify-between shadow-sm';

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
        <h2 className="text-3xl font-extrabold tracking-tight text-white font-sans">CampusFind</h2>
        <p className="mt-2 text-sm text-slate-300 font-medium">
          Digital Lost & Found Management System · SJT Block
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Solid white card (was translucent, which made it look grey) */}
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl ring-1 ring-white/20 sm:px-9">
          {/* Tab Switcher */}
          <div
            role="tablist"
            className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-7 border border-slate-200"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'student'}
              onClick={() => setActiveTab('student')}
              className={`flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'student'
                  ? 'bg-white text-brand-600 shadow ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Student
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'staff'}
              onClick={() => setActiveTab('staff')}
              className={`flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'staff'
                  ? 'bg-white text-indigo-600 shadow ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Staff & Faculty
            </button>
          </div>

          {/* TAB 1: STUDENT */}
          {activeTab === 'student' && (
            <div>
              <div className="mb-5">
                <h3 className="text-xl font-bold text-slate-900">
                  {isStudentRegister ? 'Create your account' : 'Welcome back'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {isStudentRegister
                    ? 'Register with your @vitstudent.ac.in email.'
                    : 'Sign in with your VIT student email.'}
                </p>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-4">
                {isStudentRegister && (
                  <>
                    <Field
                      id="student-name"
                      label="Full name"
                      icon={User}
                      value={studentFullName}
                      onChange={(e) => setStudentFullName(e.target.value)}
                      placeholder="Aarav Patel"
                      autoComplete="name"
                    />
                    <Field
                      id="student-regno"
                      label="Registration number"
                      icon={Hash}
                      value={studentRegNo}
                      onChange={(e) => setStudentRegNo(e.target.value)}
                      placeholder="23BCE1042"
                    />
                  </>
                )}

                <Field
                  id="student-email"
                  label="VIT student email"
                  icon={Mail}
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="name.branch2024@vitstudent.ac.in"
                  hint="Must end with @vitstudent.ac.in"
                  autoComplete="email"
                />

                <Field
                  id="student-password"
                  label="Password"
                  icon={KeyRound}
                  type="password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={isStudentRegister ? 'new-password' : 'current-password'}
                />

                <button
                  type="submit"
                  disabled={studentLoading}
                  className="w-full h-11 mt-2 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-lg shadow-brand-500/25 transition focus:outline-none focus:ring-4 focus:ring-brand-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {studentLoading ? (
                    <span>Please wait…</span>
                  ) : isStudentRegister ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign in</span>
                    </>
                  )}
                </button>

                <p className="text-sm text-slate-500 text-center pt-1">
                  {isStudentRegister ? 'Already registered?' : 'New here?'}{' '}
                  <button
                    type="button"
                    onClick={() => setIsStudentRegister(!isStudentRegister)}
                    className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    {isStudentRegister ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              </form>
            </div>
          )}

          {/* TAB 2: STAFF & FACULTY */}
          {activeTab === 'staff' && (
            <div>
              <div className="mb-5">
                <h3 className="text-xl font-bold text-slate-900">Staff & faculty sign in</h3>
                <p className="text-sm text-slate-500 mt-1">
                  For SJT desk staff, faculty and HOD.
                </p>
              </div>

              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <Field
                  id="staff-email"
                  label="Institutional email"
                  icon={Mail}
                  type="email"
                  accent="indigo"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="staff@vit.ac.in"
                  autoComplete="email"
                />

                <Field
                  id="staff-password"
                  label="Password"
                  icon={KeyRound}
                  type="password"
                  accent="indigo"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="submit"
                  disabled={staffLoading}
                  className="w-full h-11 mt-2 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 shadow-lg shadow-indigo-500/25 transition focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {staffLoading ? (
                    <span>Signing in…</span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign in</span>
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Faculty accounts are created by the HOD (
                  <span className="text-slate-700 font-medium">admin@vit.ac.in</span>).
                </p>
              </form>
            </div>
          )}

          {/* Quick Demo Pre-filled Credentials */}
          <div className="mt-7 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-600">Demo accounts</span>
              <span className="text-xs text-slate-400">Tap to fill</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillQuickDemo('aarav.patel2023@vitstudent.ac.in', 'student123', 'student')}
                className={demoBtn}
              >
                <div>
                  <span className="font-semibold text-slate-800 block text-sm">Student</span>
                  <span className="text-xs text-slate-500">Aarav Patel</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickDemo('staff@vit.ac.in', 'staff123', 'staff')}
                className={demoBtn}
              >
                <div>
                  <span className="font-semibold text-slate-800 block text-sm">SJT Staff</span>
                  <span className="text-xs text-slate-500">Desk staff</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickDemo('rajesh.faculty@vit.ac.in', 'faculty123', 'staff')}
                className={demoBtn}
              >
                <div>
                  <span className="font-semibold text-slate-800 block text-sm">Faculty</span>
                  <span className="text-xs text-slate-500">Prof. Rajesh</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => fillQuickDemo('admin@vit.ac.in', 'admin123', 'admin')}
                className={demoBtn}
              >
                <div>
                  <span className="font-semibold text-slate-800 block text-sm">HOD / Admin</span>
                  <span className="text-xs text-slate-500">Dr. Admin</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Emergency Break-Glass Admin Trigger */}
          <div className="pt-5 text-center">
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="inline-flex items-center text-sm font-semibold text-rose-600 hover:text-rose-700 transition"
            >
              <Lock className="w-4 h-4 mr-1.5" /> Emergency admin login
            </button>
          </div>
        </div>
      </div>

      {/* Break-glass Admin Login Modal */}
      {isAdminModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Emergency admin access</h3>
                <p className="text-sm text-slate-500">HOD / administrator only</p>
              </div>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <Field
                id="admin-email"
                label="Admin email"
                icon={Mail}
                type="email"
                accent="rose"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@vit.ac.in"
                autoComplete="email"
              />

              <Field
                id="admin-password"
                label="Password"
                icon={KeyRound}
                type="password"
                accent="rose"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="h-11 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="h-11 px-5 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition focus:outline-none focus:ring-4 focus:ring-rose-500/30 disabled:opacity-50"
                >
                  {adminLoading ? 'Signing in…' : 'Sign in as admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}