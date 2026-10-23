import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getMyReports, getNotifications } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { FilePlus, Files, CheckCircle2, Clock, ArrowRight, Bell } from 'lucide-react';
import dayjs from 'dayjs';

export function StudentDashboard() {
  const { user } = useAuth();

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['myReportsSummary'],
    queryFn: () => getMyReports({ page: 1, pageSize: 5 })
  });

  const { data: notifsData } = useQuery({
    queryKey: ['myNotifications'],
    queryFn: () => getNotifications({ unread: 1 })
  });

  const reports = reportsData?.data || [];
  const activeCount = reports.filter(r => ['OPEN', 'ASSIGNED', 'VISIT_SCHEDULED'].includes(r.status)).length;
  const returnedCount = reports.filter(r => r.status === 'RETURNED').length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-brand-600/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-brand-200 text-xs font-semibold uppercase tracking-wider">
            VIT Student Portal · {user?.regNo || 'Profile Active'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">
            Hello, {user?.fullName?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-brand-100 mt-2 max-w-xl">
            Lost something in SJT block? File a detailed report and our faculty team will match it with items deposited in the lost and found center.
          </p>
        </div>
        <Link
          to="/student/report-new"
          className="inline-flex items-center px-5 py-3 rounded-2xl bg-white text-brand-700 font-bold text-sm shadow-md hover:bg-brand-50 transition transform active:scale-95 flex-shrink-0"
        >
          <FilePlus className="w-4 h-4 mr-2" /> Report Lost Item
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">In Progress Reports</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{reportsLoading ? '-' : activeCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Returned Items</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{reportsLoading ? '-' : returnedCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Files className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Total Filed</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{reportsLoading ? '-' : reportsData?.total || 0}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Reports List */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-base font-bold text-slate-800">Your Recent Lost Reports</h2>
              <p className="text-xs text-slate-400">Track current review status and verification appointments</p>
            </div>
            <Link
              to="/student/reports"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
            >
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {reportsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading your reports...</div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              You haven't submitted any lost reports yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((r) => (
                <Link
                  key={r.reportId}
                  to={`/student/reports/${r.reportId}`}
                  className="py-4 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-xl transition group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition">
                        {r.category?.categoryName}
                        {r.categoryCustom ? ` (${r.categoryCustom})` : ''}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">
                        {r.location ? `${r.location.block} - ${r.location.roomName}` : (r.locationText || 'Not specified')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 max-w-md">
                      {r.description}
                    </p>
                    <span className="text-[10px] text-slate-400 block">
                      Reported {dayjs(r.createdAt).format('DD MMM YYYY, hh:mm A')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <StatusBadge status={r.status} />
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Sidebar */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-base font-bold text-slate-800 flex items-center">
              <Bell className="w-4 h-4 mr-2 text-brand-600" /> Notifications
            </h2>
          </div>

          <div className="space-y-3">
            {notifsData?.data?.length === 0 || !notifsData ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">No new notifications</p>
            ) : (
              notifsData.data.slice(0, 4).map((n) => (
                <div key={n.notificationId} className="p-3 bg-slate-50 rounded-2xl border border-slate-100/80">
                  <span className="text-xs font-bold text-slate-800 block">{n.title}</span>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block">
                    {dayjs(n.createdAt).format('DD MMM, hh:mm A')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
