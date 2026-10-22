import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { GraduationCap, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export function CompleteProfile() {
  const { user, updateStudentProfile } = useAuth();
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanRegNo = regNo.trim().toUpperCase();
    const pattern = /^\d{2}[A-Z]{3}\d{4}$/;

    if (!pattern.test(cleanRegNo)) {
      toast.error('Invalid format! Must be 2 digits + 3 uppercase letters + 4 digits (e.g. 23BCT0038)');
      return;
    }

    setLoading(true);
    try {
      await updateStudentProfile(cleanRegNo);
      navigate('/student', { replace: true });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10">
        <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-6">
          <GraduationCap className="w-6 h-6" />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Complete Your Profile</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Welcome, <span className="font-semibold text-slate-800">{user?.fullName}</span>! Please link your VIT Student Registration Number to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Registration Number
            </label>
            <input
              type="text"
              required
              value={regNo}
              onChange={(e) => setRegNo(e.target.value.toUpperCase())}
              placeholder="e.g. 23BCT0038"
              maxLength={9}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Format: 2 digits, 3 letters, 4 digits (e.g. 23BCT0038)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !regNo}
            className="w-full inline-flex items-center justify-center px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold rounded-xl transition shadow-sm text-sm"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Saving profile...</span>
              </span>
            ) : (
              <>
                <span>Continue to Dashboard</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
