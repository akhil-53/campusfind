import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFacultyQueue } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Layers, Clock, AlertTriangle, ArrowRight, Eye, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';

export function FacultyQueue() {
  const [page, setPage] = useState(1);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['facultyQueue', page, overdueOnly],
    queryFn: () => getFacultyQueue({ page, overdue: overdueOnly || undefined })
  });

  const columns = [
    {
      header: 'Report',
      accessor: 'reportId',
      cellClassName: 'font-mono text-xs font-bold text-slate-700',
      render: (a) => (
        <span className="flex items-center gap-1.5">
          <span>#{a.reportId}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            a.level > 1 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-slate-100 text-slate-700'
          }`}>
            L{a.level}
          </span>
        </span>
      )
    },
    {
      header: 'Category & Item',
      accessor: 'description',
      render: (a) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">{a.categoryName}</span>
          <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{a.description}</p>
        </div>
      )
    },
    {
      header: 'Room',
      accessor: 'roomName',
      render: (a) => <span className="text-xs font-medium text-slate-600">{a.roomName}</span>
    },
    {
      header: 'Student',
      accessor: 'studentName',
      render: (a) => (
        <div>
          <span className="text-xs font-bold text-slate-800 block">{a.studentName}</span>
          <span className="font-mono text-[10px] text-slate-400">{a.regNo}</span>
        </div>
      )
    },
    {
      header: 'Deadline Due In',
      accessor: 'dueAt',
      render: (a) => {
        const isPast = dayjs(a.dueAt).isBefore(dayjs());
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
              isPast
                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {isPast ? <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" /> : <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />}
            {dayjs(a.dueAt).format('DD MMM, hh:mm A')}
          </span>
        );
      }
    },
    {
      header: 'Suggested Matches',
      accessor: 'openMatches',
      render: (a) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
          {a.openMatches} candidates
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (a) => (
        <Link
          to={`/faculty/cases/${a.reportId}`}
          className="inline-flex items-center px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
        >
          <Eye className="w-3.5 h-3.5 mr-1" /> Review Case
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Faculty Review Queue</h1>
          <p className="text-xs text-slate-400">
            Cases assigned to your desk for match shortlisting, candidate verification, or escalation resolution.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold border transition ${
              overdueOnly
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
            {overdueOnly ? 'Showing Overdue Only' : 'Filter Overdue Cases'}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="Your review queue is clear"
        emptyDescription="There are currently no active cases assigned to your review desk."
        pagination={{
          page: data?.page || 1,
          totalPages: data?.totalPages || 1,
          total: data?.total || 0,
          pageSize: data?.pageSize || 10,
          onPageChange: setPage
        }}
      />
    </div>
  );
}
