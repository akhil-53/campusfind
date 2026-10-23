import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, createAdminUser, updateAdminUser, getDesignations } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import {
  UserPlus,
  Search,
  Edit2,
  Shield,
  UserX,
  UserCheck,
  Network,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Award,
  Briefcase,
  ShieldCheck,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export function UsersHierarchy() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    fullName: '',
    role: 'FACULTY',
    designationId: '',
    reportsToId: '',
    password: ''
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
      setNewUser({ email: '', fullName: '', role: 'FACULTY', designationId: '', reportsToId: '', password: '' });
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
        <Modal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title="Pre-Provision Institutional User"
          maxWidth="max-w-2xl"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                ...newUser,
                designationId: newUser.designationId ? parseInt(newUser.designationId, 10) : undefined,
                reportsToId: newUser.reportsToId ? parseInt(newUser.reportsToId, 10) : undefined
              });
            }}
            className="space-y-6"
          >
            {/* Header Description & Badge */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <p className="text-xs text-slate-500">
                Create institutional credentials and assign hierarchy lines before first login.
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                <ShieldCheck className="w-3 h-3 mr-1 text-brand-600" /> Authorized Admin Action
              </span>
            </div>

            {/* 1. Role Selection Cards */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Institutional Role *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    role: 'FACULTY',
                    title: 'Faculty Reviewer',
                    desc: 'Review lost reports, match items, verify claims',
                    icon: Award,
                    color: 'purple'
                  },
                  {
                    role: 'STAFF',
                    title: 'Desk Staff',
                    desc: 'Log found items, shelf tagging, search visits',
                    icon: Briefcase,
                    color: 'blue'
                  },
                  {
                    role: 'ADMIN',
                    title: 'Administrator',
                    desc: 'System governance, hierarchy, audit logs',
                    icon: ShieldCheck,
                    color: 'emerald'
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = newUser.role === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setNewUser({ ...newUser, role: item.role })}
                      className={`text-left p-3.5 rounded-2xl border-2 transition-all select-none flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50/50 shadow-sm ring-2 ring-brand-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-brand-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                          {item.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Identity Information */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. User Identity
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      placeholder="Dr. S. Ramaswamy"
                      className="w-full h-11 pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Institutional Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="ramaswamy@vit.ac.in"
                      className="w-full h-11 pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must use verified domain: <span className="font-semibold text-slate-600">@vit.ac.in</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Hierarchy Section (When Role is FACULTY) */}
            {newUser.role === 'FACULTY' && (
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                <div className="flex items-center space-x-1.5 text-slate-700">
                  <Network className="w-4 h-4 text-brand-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    3. Faculty Rank & Escalation Structure
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Faculty Level / Rank (3 Levels)
                    </label>
                    <select
                      value={newUser.designationId}
                      onChange={(e) => setNewUser({ ...newUser, designationId: e.target.value })}
                      className="w-full h-11 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="">Default (Level 1 — Faculty)</option>
                      {designationsData?.data?.map((d) => (
                        <option key={d.designationId} value={d.designationId}>
                          Level {d.levelRank} — {d.title}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Determines queue eligibility and hierarchy rank
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Reports To (Escalation Superior)
                    </label>
                    <select
                      value={newUser.reportsToId}
                      onChange={(e) => setNewUser({ ...newUser, reportsToId: e.target.value })}
                      className="w-full h-11 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="">Directly to HOD / Top Level</option>
                      {facultyUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.designation || 'Faculty'} · Level {u.designationLevel || 1})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Target officer if case review SLA lapses
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Staff Duties Banner (When Role is STAFF) */}
            {newUser.role === 'STAFF' && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <span className="font-bold block text-blue-950 mb-0.5">SJT G03 Desk Clearance:</span>
                  This staff member will have operational privileges to log incoming found items handed in by security or housekeeping, print shelf code stickers, and record in-person student search visits.
                </div>
              </div>
            )}

            {/* 4. Credentials & Access */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {newUser.role === 'FACULTY' ? '4.' : '3.'} Initial Login Password
                </label>
                <button
                  type="button"
                  onClick={() => setNewUser({
                    ...newUser,
                    password: newUser.role === 'FACULTY' ? 'faculty123' : 'staff123'
                  })}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Use Default ({newUser.role === 'FACULTY' ? 'faculty123' : 'staff123'})
                </button>
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder={newUser.role === 'FACULTY' ? 'Default: faculty123' : 'Default: staff123'}
                  className="w-full h-11 pl-10 pr-10 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Leave blank to automatically assign the default password (<code className="font-mono bg-slate-100 text-slate-700 px-1 py-0.5 rounded">{newUser.role === 'FACULTY' ? 'faculty123' : 'staff123'}</code>). User can update their credentials after initial login.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-md transition"
              >
                {createMutation.isPending ? 'Provisioning...' : 'Save & Provision Account'}
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
