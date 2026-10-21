import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, createAdminUser, updateAdminUser, getDesignations } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { UserPlus, Search, Edit2, Shield, UserX, UserCheck, Network } from 'lucide-react';
import toast from 'react-hot-toast';

export function UsersHierarchy() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    fullName: '',
    role: 'FACULTY',
    designationId: '',
    reportsToId: ''
  });

  const [editingUser, setEditingUser] = useState(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['adminUsers', page, search, roleFilter],
    queryFn: () => getAdminUsers({ page, search: search || undefined, role: roleFilter || undefined })
  });

  const { data: designationsData } = useQuery({
    queryKey: ['designations'],
    queryFn: getDesignations
  });

  // All faculty for reports-to dropdown
  const facultyUsers = (usersData?.data || []).filter(u => u.role === 'FACULTY');

  const createMutation = useMutation({
    mutationFn: (payload) => createAdminUser(payload),
    onSuccess: () => {
      toast.success('User account created and pre-provisioned!');
      queryClient.invalidateQueries(['adminUsers']);
      setIsAddOpen(false);
      setNewUser({ email: '', fullName: '', role: 'FACULTY', designationId: '', reportsToId: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAdminUser(id, data),
    onSuccess: () => {
      toast.success('User account updated!');
      queryClient.invalidateQueries(['adminUsers']);
      setEditingUser(null);
    }
  });

  const columns = [
    {
      header: 'Name & Email',
      accessor: 'fullName',
      render: (u) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">{u.fullName}</span>
          <span className="text-[11px] text-slate-400">{u.email}</span>
        </div>
      )
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (u) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
          {u.role}
        </span>
      )
    },
    {
      header: 'Designation & Level',
      accessor: 'designation',
      render: (u) => (
        u.designation ? (
          <span className="text-xs font-semibold text-slate-700">
            {u.designation} (Level {u.designationLevel})
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">None</span>
        )
      )
    },
    {
      header: 'Reports To',
      accessor: 'reportsToName',
      render: (u) => (
        u.reportsToName ? (
          <span className="text-xs font-medium text-slate-600 flex items-center">
            <Network className="w-3.5 h-3.5 mr-1 text-slate-400" />
            {u.reportsToName}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">Top Level (None)</span>
        )
      )
    },
    {
      header: 'Active Cases',
      accessor: 'activeAssignmentsCount',
      render: (u) => (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          u.activeAssignmentsCount > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-400'
        }`}>
          {u.activeAssignmentsCount} Cases
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (u) => (
        <span className={`inline-flex items-center text-xs font-semibold ${u.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {u.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (u) => (
        <button
          onClick={() => setEditingUser(u)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
          title="Edit User"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users & Faculty Hierarchy</h1>
          <p className="text-xs text-slate-400">
            Pre-provision institutional staff and faculty, manage escalation reports-to links, and control account availability.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          <UserPlus className="w-4 h-4 mr-1.5" /> Pre-Provision User
        </button>
      </div>

      {/* Search and Filters */}
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
            placeholder="Search by full name, email, or registration number..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="sm:w-48">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Roles</option>
            <option value="FACULTY">Faculty</option>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="STUDENT">Student</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={usersData?.data}
        loading={isLoading}
        emptyTitle="No users found"
        emptyDescription="No registered user matched your filter query."
        pagination={{
          page: usersData?.page || 1,
          totalPages: usersData?.totalPages || 1,
          total: usersData?.total || 0,
          pageSize: usersData?.pageSize || 15,
          onPageChange: setPage
        }}
      />

      {/* Add User Modal */}
      {isAddOpen && (
        <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Pre-Provision Institutional User">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                ...newUser,
                designationId: newUser.designationId ? parseInt(newUser.designationId, 10) : undefined,
                reportsToId: newUser.reportsToId ? parseInt(newUser.reportsToId, 10) : undefined
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                placeholder="Dr. S. Ramaswamy"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">VIT Institutional Email (@vit.ac.in) *</label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="ramaswamy@vit.ac.in"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="FACULTY">FACULTY</option>
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              {newUser.role === 'FACULTY' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={newUser.designationId}
                    onChange={(e) => setNewUser({ ...newUser, designationId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Select Designation</option>
                    {designationsData?.data?.map((d) => (
                      <option key={d.designationId} value={d.designationId}>
                        {d.title} (Level {d.levelRank})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {newUser.role === 'FACULTY' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reports To (Higher Level Faculty)</label>
                <select
                  value={newUser.reportsToId}
                  onChange={(e) => setNewUser({ ...newUser, reportsToId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">None (Top Level / Dean)</option>
                  {facultyUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.designation || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {createMutation.isPending ? 'Provisioning...' : 'Save & Provision'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit Account: ${editingUser.fullName}`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingUser.id,
                data: {
                  designationId: editingUser.designationId ? parseInt(editingUser.designationId, 10) : null,
                  reportsToId: editingUser.reportsToId ? parseInt(editingUser.reportsToId, 10) : null,
                  isActive: editingUser.isActive,
                  isAvailable: editingUser.isAvailable
                }
              });
            }}
            className="space-y-4"
          >
            {editingUser.role === 'FACULTY' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={editingUser.designationId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, designationId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">None</option>
                    {designationsData?.data?.map((d) => (
                      <option key={d.designationId} value={d.designationId}>
                        {d.title} (Level {d.levelRank})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reports To</label>
                  <select
                    value={editingUser.reportsToId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, reportsToId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">None (Top Level / Dean)</option>
                    {facultyUsers
                      .filter(u => u.id !== editingUser.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.designation || 'Faculty'})
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}

            <div className="flex items-center space-x-4 pt-2">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingUser.isActive}
                  onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Account Active</span>
              </label>

              {editingUser.role === 'FACULTY' && (
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingUser.isAvailable}
                    onChange={(e) => setEditingUser({ ...editingUser, isAvailable: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Available for Auto-Assignment</span>
                </label>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {updateMutation.isPending ? 'Saving...' : 'Update Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
