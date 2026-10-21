import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTheftCases, acknowledgeTheftCase } from '../../api/client';
import { Modal } from '../../components/Modal';
import { ShieldAlert, CheckCircle, Clock, MapPin, User, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

export function TheftCases() {
  const queryClient = useQueryClient();
  const [selectedCase, setSelectedCase] = useState(null);
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['theftCases'],
    queryFn: getTheftCases
  });

  const ackMutation = useMutation({
    mutationFn: ({ reportId, notes }) => acknowledgeTheftCase(reportId, notes),
    onSuccess: () => {
      toast.success('Theft case acknowledged and tracking resolved.');
      queryClient.invalidateQueries(['theftCases']);
      setSelectedCase(null);
      setNotes('');
    }
  });

  const cases = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <ShieldAlert className="w-6 h-6 mr-2 text-rose-600" />
            Theft Tracking Queue
          </h1>
          <p className="text-xs text-slate-400">
            Cases escalated following SJT room visit with CCTV theft confirmation.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading theft cases...</div>
      ) : cases.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No active theft cases</h3>
          <p className="text-xs text-slate-500 mt-1">There are no pending theft tracking cases assigned to your desk.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cases.map((c) => (
            <div
              key={c.assignmentId}
              className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />

              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-400">CASE #{c.reportId}</span>
                  <h3 className="text-base font-bold text-slate-800 mt-0.5">{c.description}</h3>
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                  Theft Suspected
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span>Student: <strong>{c.studentName}</strong></span>
                  <span className="font-mono font-bold text-brand-600">{c.regNo}</span>
                </div>
                <div className="flex items-center text-slate-500">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <span>Room: {c.roomName}</span>
                </div>
              </div>

              {/* CCTV Notes */}
              <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-200/80 text-xs">
                <span className="font-bold text-rose-900 block mb-0.5">Staff CCTV Notes:</span>
                <p className="text-rose-800 leading-relaxed italic">{c.cctvNotes}</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Assigned: {dayjs(c.visitedAt).format('DD MMM, hh:mm A')}
                </span>
                <button
                  onClick={() => setSelectedCase(c)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  Acknowledge & Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Acknowledge Modal */}
      {selectedCase && (
        <Modal
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          title={`Acknowledge Theft Case #${selectedCase.reportId}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ackMutation.mutate({ reportId: selectedCase.reportId, notes });
            }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-500">
              Acknowledging this case records formal administrative action notes and terminates automated timer escalation.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Investigation Action Notes *</label>
              <textarea
                rows={3}
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document actions taken (e.g. Campus Security footage secured, police complaint lodged, student interviewed)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={ackMutation.isPending || !notes.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {ackMutation.isPending ? 'Logging...' : 'Confirm Action'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
