import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from './NotificationBell';
import { toggleAvailability } from '../api/client';
import { Menu, User, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function Navbar({ onMenuClick }) {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable ?? true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  const handleToggleAvailability = async () => {
    setUpdatingAvailability(true);
    try {
      const res = await toggleAvailability(!isAvailable);
      setIsAvailable(res.isAvailable);
      toast.success(res.message);
    } catch (e) {}
    setUpdatingAvailability(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-slate-400">CampusFind System</span>
          <h1 className="text-sm font-bold text-slate-800 leading-none mt-0.5">
            SJT Lost & Found Center
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Faculty Availability Switch */}
        {user?.role === 'FACULTY' && (
          <button
            onClick={handleToggleAvailability}
            disabled={updatingAvailability}
            className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              isAvailable
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            title="Toggle your availability for automatic case assignment"
          >
            {isAvailable ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Available for cases
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Unavailable
              </>
            )}
          </button>
        )}

        {/* Notifications Bell */}
        <NotificationBell />

        {/* User Chip */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {user?.fullName ? user.fullName[0].toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="hidden md:block text-left">
            <span className="block text-xs font-bold text-slate-800 leading-tight">
              {user?.fullName}
            </span>
            <span className="block text-[10px] text-slate-400 leading-tight">
              {user?.regNo || user?.email}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
