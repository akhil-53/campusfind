import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAdminStats, runAdminJobs } from '../../api/client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ClockAlert,
  Play,
  TrendingUp,
  MapPin,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminDashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats
  });

  const runJobsMutation = useMutation({
    mutationFn: runAdminJobs,
    onSuccess: (res) => {
      toast.success(res.message || 'Background escalation & assignment jobs ran successfully!');
      refetch();
    }
  });

  const { overview = {}, categoryStats = [], roomHotspots = [], escalationsPerFaculty = [], reportsPerDay = [] } =
    data || {};

  return (
    <div className="space-y-8">
      {/* Header and Live Job Trigger */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-brand-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">CampusFind Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">System Analytics & Controls</h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Real-time workflow monitoring, escalation timers, category recovery performance, and manual job triggers.
          </p>
        </div>

        <button
          onClick={() => runJobsMutation.mutate()}
          disabled={runJobsMutation.isPending}
          className="inline-flex items-center px-5 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition transform active:scale-95 flex-shrink-0"
        >
          <Play className="w-4 h-4 mr-2" />
          {runJobsMutation.isPending ? 'Running Jobs...' : 'Run Scheduled Jobs Now'}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Active Cases</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{isLoading ? '-' : overview.activeReports ?? 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ClockAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Overdue Cases</span>
            <h3 className="text-2xl font-extrabold text-rose-600">{isLoading ? '-' : overview.overdueAssignments ?? 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Items Returned</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{isLoading ? '-' : overview.returnedReports ?? 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Room Inventory</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{isLoading ? '-' : overview.itemsInRoom ?? 0}</h3>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reports per day (Last 14 days) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Lost Reports Filed (Last 14 Days)</h2>
              <p className="text-xs text-slate-400">Daily student report filing volume</p>
            </div>
            <TrendingUp className="w-4 h-4 text-brand-600" />
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportsPerDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="count" stroke="#0e8ce4" strokeWidth={3} dot={{ r: 4, fill: '#0e8ce4' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Recovery Rate */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Recovery Rate by Category (%)</h2>
              <p className="text-xs text-slate-400">Percentage of items successfully returned to owners</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="categoryName" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={0} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="recoveryPct" fill="#10b981" radius={[6, 6, 0, 0]} name="Recovery %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Room Hotspots */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Top SJT Loss Hotspots</h2>
              <p className="text-xs text-slate-400">Classrooms and halls with highest reported incidents</p>
            </div>
            <MapPin className="w-4 h-4 text-rose-500" />
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomHotspots}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="roomName" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="reports" fill="#6366f1" radius={[6, 6, 0, 0]} name="Reports" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Escalations per Faculty Member */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Escalations by Reviewer</h2>
            <p className="text-xs text-slate-400">Cases that exceeded review deadlines and escalated up the hierarchy</p>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {escalationsPerFaculty.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center italic">No cases have escalated past deadlines.</p>
            ) : (
              escalationsPerFaculty.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{item.fullName}</span>
                  <span className="px-2.5 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {item.escalated} Escalated
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
