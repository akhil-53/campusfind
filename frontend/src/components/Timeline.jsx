import React from 'react';
import dayjs from 'dayjs';
import { CheckCircle2, Clock } from 'lucide-react';

export function Timeline({ events = [] }) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-slate-400 italic">No timeline events recorded yet.</p>;
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {events.map((event, index) => (
        <div key={event.logId || index} className="relative group">
          <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-white border-2 border-brand-500 flex items-center justify-center text-brand-600">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                {event.action.replace('STATUS ', 'Status: ').replace(/_/g, ' ')}
              </span>
              <span className="text-[11px] text-slate-400">
                {dayjs(event.createdAt).format('DD MMM YYYY, hh:mm A')}
              </span>
            </div>
            {event.details?.closed_reason && (
              <p className="text-xs text-slate-500 mt-0.5">
                Reason: {event.details.closed_reason.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
