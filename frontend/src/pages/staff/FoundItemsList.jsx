import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getFoundItems, getMeta, disposeItem, markHandedOver, updateFoundItem } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  PackagePlus,
  Search,
  Filter,
  Trash2,
  HeartHandshake,
  CheckCircle,
  Edit2,
  Boxes,
  Files,
  Image as ImageIcon
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

export function FoundItemsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Modals state
  const [disposeModalItem, setDisposeModalItem] = useState(null);
  const [disposeAction, setDisposeAction] = useState('DISPOSED');
  const [disposeReason, setDisposeReason] = useState('');

  const [handoverConfirmItem, setHandoverConfirmItem] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const { data: metaData } = useQuery({ queryKey: ['meta'], queryFn: getMeta });

  const { data, isLoading } = useQuery({
    queryKey: ['foundItems', page, search, categoryId, status, flaggedOnly],
    queryFn: () =>
      getFoundItems({
        page,
        search: search || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
        flagged: flaggedOnly || undefined
      })
  });

  const disposeMutation = useMutation({
    mutationFn: () => disposeItem(disposeModalItem.foundId, { action: disposeAction, reason: disposeReason }),
    onSuccess: () => {
      toast.success(`Item successfully marked as ${disposeAction.toLowerCase()}`);
      queryClient.invalidateQueries(['foundItems']);
      setDisposeModalItem(null);
      setDisposeReason('');
    }
  });

  const handoverMutation = useMutation({
    mutationFn: (id) => markHandedOver(id),
    onSuccess: () => {
      toast.success('Physical handover confirmed!');
      queryClient.invalidateQueries(['foundItems']);
      setHandoverConfirmItem(null);
    }
  });

  const columns = [
    {
      header: 'Photo',
      accessor: 'images',
      render: (item) => {
        const photo = item.images?.[0]?.url;
        return (
          <div
            onClick={() => photo && setPreviewImage(photo)}
            className={`w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center ${
              photo ? 'cursor-pointer hover:opacity-80' : ''
            }`}
          >
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-4 h-4 text-slate-400" />
            )}
          </div>
        );
      }
    },
    {
      header: 'Shelf Tag',
      accessor: 'shelfCode',
      render: (item) => (
        <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded-md tracking-wider">
          {item.shelfCode}
        </span>
      )
    },
    {
      header: 'Item Details',
      accessor: 'description',
      render: (item) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">
            {item.category?.categoryName}
            {item.categoryCustom && (
              <span className="text-brand-600 font-semibold ml-1">({item.categoryCustom})</span>
            )}
          </span>
          <p className="text-xs text-slate-600 line-clamp-1 max-w-xs">{item.description}</p>
          {(item.brand || item.color) && (
            <span className="text-[10px] text-slate-400">
              {[item.brand, item.color].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Found Room & Date',
      accessor: 'foundAt',
      render: (item) => (
        <div>
          <span className="text-xs font-medium text-slate-700 block">
            {item.location ? `${item.location.block} - ${item.location.roomName}` : (item.locationText || 'Not specified')}
          </span>
          <span className="text-[10px] text-slate-400">{dayjs(item.foundAt).format('DD MMM YYYY, hh:mm A')}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (item) => (
        <div className="space-y-1">
          <StatusBadge status={item.status} />
          {item.unclaimedFlaggedAt && item.status === 'AVAILABLE' && (
            <span className="block text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-center">
              Flagged Unclaimed
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (item) => (
        <div className="flex items-center space-x-1.5">
          {item.status === 'AVAILABLE' && (
            <button
              onClick={() => setDisposeModalItem(item)}
              title="Dispose or Donate Item"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {item.status === 'AVAILABLE' && (
            <button
              onClick={() => setHandoverConfirmItem(item)}
              title="Confirm Handover to Student"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
            >
              <CheckCircle className="w-3.5 h-3.5" />
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
          <h1 className="text-2xl font-bold text-slate-800">Found Inventory</h1>
          <p className="text-xs text-slate-400">
            Track shelf codes, photograph uploads, and item lifecycles in SJT G03 storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'ADMIN' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <Link
                to="/admin/reports"
                className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 font-medium text-xs transition"
              >
                <Files className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Lost Reports
              </Link>
              <span className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-white text-brand-700 font-bold text-xs shadow-sm">
                <Boxes className="w-3.5 h-3.5 mr-1.5" /> Found Inventory
              </span>
            </div>
          )}

          <Link
            to="/staff/items/new"
            className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <PackagePlus className="w-4 h-4 mr-1.5" /> Log New Found Item
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search shelf code, brand, description..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Categories</option>
            {metaData?.categories?.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="RETURNED">Returned</option>
            <option value="DISPOSED">Disposed</option>
            <option value="DONATED">Donated</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        emptyTitle="No found items in storage"
        emptyDescription="No registered items matched your filter or search query."
        pagination={{
          page: data?.page || 1,
          totalPages: data?.totalPages || 1,
          total: data?.total || 0,
          pageSize: data?.pageSize || 10,
          onPageChange: setPage
        }}
      />

      {/* Dispose / Donate Modal */}
      {disposeModalItem && (
        <Modal
          isOpen={!!disposeModalItem}
          onClose={() => setDisposeModalItem(null)}
          title={`Dispose / Donate: ${disposeModalItem.shelfCode}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Unclaimed items past retention window can be safely disposed or donated according to university protocol.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Action</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDisposeAction('DISPOSED')}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                    disposeAction === 'DISPOSED'
                      ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Mark as Disposed
                </button>
                <button
                  type="button"
                  onClick={() => setDisposeAction('DONATED')}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                    disposeAction === 'DONATED'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Mark as Donated
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Notes *</label>
              <textarea
                rows={3}
                required
                value={disposeReason}
                onChange={(e) => setDisposeReason(e.target.value)}
                placeholder="e.g. Unclaimed for > 45 days, transferred to NGO drive or recycling center..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDisposeModalItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!disposeReason.trim() || disposeMutation.isPending}
                onClick={() => disposeMutation.mutate()}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition shadow-sm"
              >
                {disposeMutation.isPending ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Handover Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!handoverConfirmItem}
        onClose={() => setHandoverConfirmItem(null)}
        onConfirm={() => handoverMutation.mutate(handoverConfirmItem.foundId)}
        loading={handoverMutation.isPending}
        title="Confirm Counter Handover"
        message={`Mark item [${handoverConfirmItem?.shelfCode} - ${handoverConfirmItem?.description}] as handed over to student? This will stamp the verified letter.`}
        confirmText="Confirm Handover"
        isDestructive={false}
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Item Photo" maxWidth="max-w-xl">
          <div className="rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center max-h-[70vh]">
            <img src={previewImage} alt="Found item" className="max-w-full max-h-[70vh] object-contain" />
          </div>
        </Modal>
      )}
    </div>
  );
}
