import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { ScrollText, Search, Filter, Calendar } from 'lucide-react';
import dayjs from 'dayjs';

export function AuditLogs() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['adminAuditLogs', page, entity, action],
    queryFn: () => getAuditLogs({ page, entity: entity || undefined, action: action || undefined })
  });

  const columns = [
    {
      header: 'Log ID',
      accessor: 'logId',
      cellClassName: 'font-mono text-xs font-bold text-slate-400',
      render: (l) => `#${l.logId}`
    },
    {
      header: 'Actor',
      accessor: 'actorName',
      render: (l) => (
        <div>
          <span className={`text-xs font-bold block ${l.actorName === 'System Job' ? 'text-indigo-600' : 'text-slate-800'}`}>
            {l.actorName}
          </span>
          {l.actorEmail && <span className="text-[10px] text-slate-400">{l.actorEmail}</span>}
        </div>
      )
    },
    {
      header: 'Action Taken',
      accessor: 'action',
      render: (l) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
          {l.action}
        </span>
      )
    },
    {
      header: 'Entity / Target',
      accessor: 'entityName',
      render: (l) => (
        <span className="text-xs text-slate-600">
          <strong>{l.entityName}</strong> {l.entityId ? `(#${l.entityId})` : ''}
        </span>
      )
    },
    {
      header: 'Details',
      accessor: 'details',
      render: (l) => (
        l.details ? (
          <code className="text-[10px] bg-slate-50 text-slate-600 p-1 rounded border border-slate-200 block max-w-xs truncate font-mono">
            {JSON.stringify(l.details)}
          </code>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )
      )
    },
    {
      header: 'Timestamp',
      accessor: 'createdAt',
      render: (l) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {dayjs(l.createdAt).format('DD MMM YYYY, hh:mm A')}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <ScrollText className="w-6 h-6 mr-2 text-brand-600" />
          System Audit Trail
        </h1>
        <p className="text-xs text-slate-400">
          Immutable event log tracking all status transitions, verification outcomes, assignments, and job executions.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            placeholder="Search action string (e.g. ASSIGNED, STATUS, HANDOVER)..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="sm:w-48">
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Entities</option>
            <option value="lost_reports">Lost Reports</option>
            <option value="found_items">Found Items</option>
            <option value="verifications">Verifications</option>
            <option value="assignments">Assignments</option>
            <option value="room_visits">Room Visits</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="No audit logs found"
        emptyDescription="No events match your current filter parameters."
        pagination={{
          page: data?.page || 1,
          totalPages: data?.totalPages || 1,
          total: data?.total || 0,
          pageSize: data?.pageSize || 20,
          onPageChange: setPage
        }}
      />
    </div>
  );
}
