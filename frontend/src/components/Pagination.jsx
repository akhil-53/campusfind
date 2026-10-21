import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, total, onPageChange, pageSize }) {
  if (totalPages <= 1 && total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100 rounded-b-xl text-sm text-slate-500">
      <div>
        Showing <span className="font-semibold text-slate-700">{total > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
        <span className="font-semibold text-slate-700">{Math.min(page * pageSize, total)}</span> of{' '}
        <span className="font-semibold text-slate-700">{total}</span> records
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium px-2 text-slate-600">
          Page {page} of {totalPages || 1}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
