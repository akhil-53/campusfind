import React from 'react';

const STATUS_CONFIG = {
  OPEN: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Submitted'
  },
  ASSIGNED: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    label: 'Under review'
  },
  VISIT_SCHEDULED: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    label: 'Visit scheduled'
  },
  RETURNED: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Returned'
  },
  NOT_FOUND: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Not found — visit room'
  },
  THEFT_FORWARDED: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Forwarded for action'
  },
  CLOSED: {
    bg: 'bg-slate-100 text-slate-500 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Closed'
  },
  // Item statuses
  AVAILABLE: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'In SJT Room'
  },
  DISPOSED: {
    bg: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    label: 'Disposed'
  },
  DONATED: {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    label: 'Donated'
  },
  // Match statuses
  SUGGESTED: {
    bg: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
    label: 'Suggested'
  },
  SHORTLISTED: {
    bg: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    label: 'Shortlisted'
  },
  DISMISSED: {
    bg: 'bg-slate-100 text-slate-400 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Dismissed'
  },
  CONFIRMED: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Confirmed'
  },
  FAILED: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Failed'
  }
};

export function StatusBadge({ status, customLabel, size = 'md' }) {
  const config = STATUS_CONFIG[status] || {
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    label: status?.replace('_', ' ') || 'Unknown'
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-full ${config.bg} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {customLabel || config.label}
    </span>
  );
}
