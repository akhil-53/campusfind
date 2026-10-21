import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFoundItems, getStaffNotFoundCases } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import {
  PackagePlus,
  ClipboardList,
  Boxes,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import dayjs from 'dayjs';

export function StaffDashboard() {
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['staffItemsSummary'],
    queryFn: () => getFoundItems({ page: 1, pageSize: 5 })
  });

  const { data: notFoundData } = useQuery({
    queryKey: ['staffNotFoundSummary'],
    queryFn: () => getStaffNotFoundCases({ page: 1, pageSize: 5 })
  });

  const items = itemsData?.data || [];
  const inRoomCount = itemsData?.total || 0;
  const flaggedCount = items.filter(i => i.unclaimedFlaggedAt).length;

  return (
    <div className="space-y-8">
      {/* Staff Hub Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-brand-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">SJT Lost & Found Room Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Staff Inventory Desk</h1>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            Log found items handed into SJT G03, organize shelf tags, record student manual room searches, and update CCTV review logs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/staff/items/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition"
          >
            <PackagePlus className="w-4 h-4 mr-1.5" /> Log Found Item
          </Link>
          <Link
            to="/staff/visits/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition"
          >
            <ClipboardList className="w-4 h-4 mr-1.5" /> Record Room Visit
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Items in SJT Room</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{itemsLoading ? '-' : inRoomCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Flagged Unclaimed (&gt;30d)</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{flaggedCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Active Room Search Cases</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{notFoundData?.total || 0}</h3>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recently Logged Items */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-base font-bold text-slate-800">Recently Logged Items</h2>
              <p className="text-xs text-slate-400">Inventory items currently in shelf storage</p>
            </div>
            <Link
              to="/staff/items"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
            >
              Full inventory <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.foundId}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center">
                    {item.images?.[0]?.url ? (
                      <img src={item.images[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Boxes className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md">
                        {item.shelfCode}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{item.category?.categoryName}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
                    <span className="text-[10px] text-slate-400 block">
                      Found in {item.location?.roomName} · {dayjs(item.foundAt).format('DD MMM, hh:mm A')}
                    </span>
                  </div>
                </div>
                <StatusBadge status={item.status} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Room Search Cases (Not-Found) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-base font-bold text-slate-800">Pending Student Visits</h2>
              <p className="text-xs text-slate-400">Students with NOT_FOUND cases</p>
            </div>
            <Link
              to="/staff/not-found"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
            >
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="space-y-3">
            {notFoundData?.data?.slice(0, 4).map((c) => (
              <div key={c.reportId} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-700">{c.regNo}</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Visit by {dayjs(c.visitDeadline).format('DD MMM')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-1">{c.description}</p>
                <Link
                  to={`/staff/visits/new?reportId=${c.reportId}`}
                  className="inline-flex items-center text-[11px] font-bold text-brand-600 hover:text-brand-700"
                >
                  Record visit <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
