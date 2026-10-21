import React from 'react';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';

export function DataTable({
  columns,
  data = [],
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse w-full"></div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {columns.map((col, index) => (
                <th key={index} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {data.map((row, rowIndex) => (
              <tr
                key={row.id || row.reportId || row.foundId || row.assignmentId || rowIndex}
                className="hover:bg-slate-50/60 transition"
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className={`px-5 py-4 ${col.cellClassName || ''}`}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
