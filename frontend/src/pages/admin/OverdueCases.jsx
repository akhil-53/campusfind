import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOverdueCases, reassignReport, getAdminUsers } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { ClockAlert, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

export function OverdueCases() {
  const queryClient = useQueryClient();
  const [reassignReportId, setReassignReportId] = useState(null);
  const [targetFacultyId, setTargetFacultyId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['adminOverdueCases'],
    queryFn: getOverdueCases
  });

  const { data: usersData } = useQuery({
    queryKey: ['facultyUsersAdmin'],
    queryFn: () => getAdminUsers({ role: 'FACULTY', pageSize: 100 })
  });

  const facultyUsers = usersData?.data || [];

  const reassignMutation = useMutation({
    mutationFn: () => reassignReport(reassignReportId, parseInt(targetFacultyId, 10)),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries(['adminOverdueCases']);
      setReassignReportId(null);
    }
  });

  const columns = [
    {
      header: 'Report ID',
      accessor: 'reportId',
      cellClassName: 'font-mono text-xs font-bold text-slate-700',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span>#{r.reportId}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            L{r.level}
          </span>
        </span>
      )
    },
    {
      header: 'Current Assignee',
      accessor: 'assigneeName',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">{r.assigneeName}</span>
          <span className="text-[10px] text-slate-400">{r.designation}</span>
        </div>
      )
    },
    {
      header: 'Hierarchy Position',
      accessor: 'atTop',
      render: (r) => (
        r.atTop ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">
            At Top (Dean Level)
          </span>
        ) : (
          <span className="text-xs text-slate-500">Escalating to Reporting Officer</span>
        )
      )
    },
    {
      header: 'Item & Room',
      accessor: 'categoryName',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-700 text-xs block">{r.categoryName}</span>
          <span className="text-[11px] text-slate-500">{r.roomName}</span>
        </div>
      )
    },
    {
      header: 'Expired Deadline',
      accessor: 'dueAt',
      render: (r) => (
        <span className="text-xs font-bold text-rose-600 flex items-center">
          <ClockAlert className="w-3.5 h-3.5 mr-1" />
          {dayjs(r.dueAt).format('DD MMM, hh:mm A')}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (r) => (
        <button
          onClick={() => {
            setReassignReportId(r.reportId);
            setTargetFacultyId('');
          }}
          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          Reassign Now
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <ClockAlert className="w-6 h-6 mr-2 text-rose-600" />
          Overdue Cases Escalation Monitor
        </h1>
        <p className="text-xs text-slate-400">
          Cases past their review deadlines. Automated jobs escalate them up the hierarchy (Faculty → HOD → Dean).
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="No overdue cases"
        emptyDescription="All active review assignments are currently within their designated deadlines."
      />

      {/* Reassign Modal */}
      {reassignReportId && (
        <Modal
          isOpen={!!reassignReportId}
          onClose={() => setReassignReportId(null)}
          title={`Reassign Overdue Case #${reassignReportId}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Replacement Faculty *</label>
              <select
                value={targetFacultyId}
                onChange={(e) => setTargetFacultyId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">Choose Faculty Member</option>
                {facultyUsers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fullName} ({f.designation || 'Faculty'}) · {f.activeAssignmentsCount} cases
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReassignReportId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetFacultyId || reassignMutation.isPending}
                onClick={() => reassignMutation.mutate()}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {reassignMutation.isPending ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
