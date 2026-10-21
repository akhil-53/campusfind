import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getStaffNotFoundCases } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { Search, HelpCircle, ClipboardList, Calendar } from 'lucide-react';
import dayjs from 'dayjs';

export function NotFoundCases() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staffNotFoundCases', page, search],
    queryFn: () => getStaffNotFoundCases({ page, search: search || undefined })
  });

  const columns = [
    {
      header: 'Report ID',
      accessor: 'reportId',
      cellClassName: 'font-mono text-xs font-bold text-slate-700',
      render: (r) => `#${r.reportId}`
    },
    {
      header: 'Student',
      accessor: 'studentName',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-800 block text-xs">{r.studentName}</span>
          <span className="font-mono text-[11px] text-brand-600 font-semibold">{r.regNo}</span>
        </div>
      )
    },
    {
      header: 'Category & Item (No Marks)',
      accessor: 'description',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-700 block text-xs">{r.categoryName}</span>
          <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{r.description}</p>
        </div>
      )
    },
    {
      header: 'Lost Room',
      accessor: 'roomName',
      render: (r) => <span className="text-xs font-medium text-slate-600">{r.roomName}</span>
    },
    {
      header: 'Room Search Deadline',
      accessor: 'visitDeadline',
      render: (r) => {
        const isPast = dayjs(r.visitDeadline).isBefore(dayjs());
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              isPast ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Calendar className="w-3 h-3 mr-1" />
            {dayjs(r.visitDeadline).format('DD MMM YYYY')}
          </span>
        );
      }
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (r) => (
        <Link
          to={`/staff/visits/new?reportId=${r.reportId}`}
          className="inline-flex items-center px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
        >
          <ClipboardList className="w-3.5 h-3.5 mr-1" /> Record Visit
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Room Search Cases (NOT_FOUND)</h1>
          <p className="text-xs text-slate-400">
            Cases declared NOT_FOUND where students can visit SJT G03 in person to search the shelves. Note: Identifying marks are omitted to prevent bias.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by student reg no or name..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="No pending room search cases"
        emptyDescription="There are currently no reports awaiting student physical room search."
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
