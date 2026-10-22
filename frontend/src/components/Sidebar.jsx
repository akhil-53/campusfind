import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  Compass,
  FilePlus,
  Files,
  PackagePlus,
  Boxes,
  HelpCircle,
  ClipboardList,
  Layers,
  ShieldCheck,
  Users,
  Network,
  ClockAlert,
  SlidersHorizontal,
  ScrollText,
  LogOut,
  Sparkles
} from 'lucide-react';

export function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();

  const getNavLinks = () => {
    switch (user?.role) {
      case 'STUDENT':
        return [
          { to: '/student', label: 'Dashboard', icon: Compass, end: true },
          { to: '/student/report-new', label: 'Report Lost Item', icon: FilePlus },
          { to: '/student/reports', label: 'My Reports', icon: Files }
        ];
      case 'STAFF':
        return [
          { to: '/staff', label: 'Dashboard', icon: Compass, end: true },
          { to: '/staff/items/new', label: 'Log Found Item', icon: PackagePlus, end: true },
          { to: '/staff/items', label: 'Found Inventory', icon: Boxes, end: true },
          { to: '/staff/not-found', label: 'Room Search Cases', icon: HelpCircle },
          { to: '/staff/visits/new', label: 'Record Room Visit', icon: ClipboardList, end: true }
        ];
      case 'FACULTY':
        return [
          { to: '/faculty', label: 'Review Queue', icon: Layers, end: true },
          { to: '/faculty/theft', label: 'Theft Tracking', icon: ShieldCheck }
        ];
      case 'ADMIN':
        return [
          { to: '/admin', label: 'Overview', icon: Compass, end: true },
          { to: '/faculty', label: 'Faculty Queue', icon: Layers, end: true },
          { to: '/faculty/theft', label: 'Theft Tracking', icon: ShieldCheck },
          { to: '/admin/users', label: 'Faculty & Staff', icon: Users },
          { to: '/admin/hierarchy', label: 'Hierarchy Tree', icon: Network },
          { to: '/admin/reports', label: 'All Reports', icon: Files },
          { to: '/admin/overdue', label: 'Overdue Cases', icon: ClockAlert },
          { to: '/admin/settings', label: 'Settings & Master', icon: SlidersHorizontal },
          { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText }
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white">CampusFind</span>
            <span className="block text-[10px] text-slate-400 font-medium">SJT Lost & Found</span>
          </div>
        </div>

        {/* User Role Tag */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {user?.role} PORTAL
            </span>
            {user?.designation && (
              <span className="text-[10px] font-medium bg-brand-950 text-brand-300 border border-brand-800 px-2 py-0.5 rounded-full">
                {user.designation}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-200 mt-1 truncate">{user?.fullName}</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={logout}
            className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition"
          >
            <LogOut className="w-4 h-4 mr-3 flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
