import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyReports } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { FilePlus, Eye, Filter } from 'lucide-react';
import dayjs from 'dayjs';

export function MyReports() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['myReports', page, statusFilter],
    queryFn: () => getMyReports({ page, status: statusFilter || undefined })
  });

  const columns = [
    {
      header: 'Report ID',
      accessor: 'reportId',
      cellClassName: 'font-mono text-xs font-bold text-slate-700',
      render: (r) => `#${r.reportId}`
    },
    {
      header: 'Category & Item',
      accessor: 'categoryName',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-800 block text-xs">{r.category?.categoryName}</span>
          <span className="text-xs text-slate-500 line-clamp-1">{r.description}</span>
        </div>
      )
    },
    {
      header: 'Location',
      accessor: 'roomName',
      render: (r) => (
        <span className="text-xs text-slate-600 font-medium">
          {r.location?.block} - {r.location?.roomName}
        </span>
      )
    },
    {
      header: 'Filed On',
      accessor: 'createdAt',
      render: (r) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {dayjs(r.createdAt).format('DD MMM YYYY')}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (r) => (
        <Link
          to={`/student/reports/${r.reportId}`}
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-600 text-xs font-semibold transition"
        >
          <Eye className="w-3.5 h-3.5 mr-1" /> View
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Lost Reports</h1>
          <p className="text-xs text-slate-400">
            View full history, status updates, and verification schedules for your filed reports.
          </p>
        </div>

        <Link
          to="/student/report-new"
          className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          <FilePlus className="w-4 h-4 mr-1.5" /> File New Report
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center space-x-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm max-w-sm">
        <Filter className="w-4 h-4 text-slate-400 ml-1" />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Submitted (Open)</option>
          <option value="ASSIGNED">Under Review</option>
          <option value="VISIT_SCHEDULED">Visit Scheduled</option>
          <option value="RETURNED">Returned</option>
          <option value="NOT_FOUND">Not Found — Visit Room</option>
          <option value="THEFT_FORWARDED">Forwarded for Action</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="No lost reports found"
        emptyDescription="You haven't filed any reports matching this filter criteria."
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
