import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllReportsAdmin, reassignReport, closeReportAdmin, getAdminUsers } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Search, UserCheck, XCircle, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

export function AllReports() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  // Reassign modal state
  const [reassignReportId, setReassignReportId] = useState(null);
  const [targetFacultyId, setTargetFacultyId] = useState('');

  // Close report confirm state
  const [closeReportId, setCloseReportId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminAllReports', page, status, search],
    queryFn: () => getAllReportsAdmin({ page, status: status || undefined, search: search || undefined })
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
      queryClient.invalidateQueries(['adminAllReports']);
      setReassignReportId(null);
      setTargetFacultyId('');
    }
  });

  const closeMutation = useMutation({
    mutationFn: () => closeReportAdmin(closeReportId),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries(['adminAllReports']);
      setCloseReportId(null);
    }
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
          <span className="font-bold text-slate-800 text-xs block">{r.studentName}</span>
          <span className="font-mono text-[10px] text-brand-600 font-semibold">{r.regNo}</span>
        </div>
      )
    },
    {
      header: 'Category & Details',
      accessor: 'description',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">
            {r.categoryName}
            {r.categoryCustom && (
              <span className="text-brand-600 font-semibold ml-1">({r.categoryCustom})</span>
            )}
          </span>
          <p className="text-xs text-slate-600 line-clamp-1 max-w-xs">{r.description}</p>
          <span className="text-[10px] text-amber-700 italic block mt-0.5">
            Marks: {r.identifyingMarks}
          </span>
        </div>
      )
    },
    {
      header: 'Location',
      accessor: 'roomName',
      render: (r) => <span className="text-xs font-medium text-slate-600">{r.roomName}</span>
    },
    {
      header: 'Current Assignee',
      accessor: 'currentAssignee',
      render: (r) => <span className="text-xs font-semibold text-slate-700">{r.currentAssignee}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (r) => (
        <div className="flex items-center space-x-1.5">
          {!['RETURNED', 'CLOSED'].includes(r.status) && (
            <button
              onClick={() => {
                setReassignReportId(r.reportId);
                setTargetFacultyId('');
              }}
              title="Reassign to another faculty"
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-xs font-semibold transition"
            >
              Reassign
            </button>
          )}

          {!['RETURNED', 'CLOSED'].includes(r.status) && (
            <button
              onClick={() => setCloseReportId(r.reportId)}
              title="Administrative Close"
              className="p-1 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Lost Reports</h1>
          <p className="text-xs text-slate-400">
            Administrative overview of all submitted cases with confidential mark audit and reassignment overrides.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by student, reg no, description, or marks..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="sm:w-48">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="VISIT_SCHEDULED">VISIT_SCHEDULED</option>
            <option value="RETURNED">RETURNED</option>
            <option value="NOT_FOUND">NOT_FOUND</option>
            <option value="THEFT_FORWARDED">THEFT_FORWARDED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="No reports found"
        emptyDescription="No student lost reports matched your criteria."
        pagination={{
          page: data?.page || 1,
          totalPages: data?.totalPages || 1,
          total: data?.total || 0,
          pageSize: data?.pageSize || 15,
          onPageChange: setPage
        }}
      />

      {/* Reassign Modal */}
      {reassignReportId && (
        <Modal
          isOpen={!!reassignReportId}
          onClose={() => setReassignReportId(null)}
          title={`Reassign Report #${reassignReportId}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Reassigning this report will complete the current reviewer's assignment and immediately route the case to the chosen faculty reviewer.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Target Faculty *</label>
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

      {/* Close Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!closeReportId}
        onClose={() => setCloseReportId(null)}
        onConfirm={() => closeMutation.mutate()}
        loading={closeMutation.isPending}
        title="Admin Close Report"
        message={`Are you sure you want to administratively close report #${closeReportId}? This will cancel all pending verifications and complete assignments.`}
        confirmText="Confirm Close"
        isDestructive={true}
      />
    </div>
  );
}
