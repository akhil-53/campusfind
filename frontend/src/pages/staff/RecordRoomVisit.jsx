import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStaffNotFoundCases, getFoundItems, recordRoomVisit } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ClipboardList, ArrowLeft, Search, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export function RecordRoomVisit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialReportId = searchParams.get('reportId') || '';

  const [selectedReportId, setSelectedReportId] = useState(initialReportId);
  const [manualSearchResult, setManualSearchResult] = useState('NOT_FOUND');
  const [selectedFoundId, setSelectedFoundId] = useState('');
  const [cctvChecked, setCctvChecked] = useState(false);
  const [cctvOutcome, setCctvOutcome] = useState('NOT_VISIBLE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [theftConfirmOpen, setTheftConfirmOpen] = useState(false);

  // Fetch NOT_FOUND reports to pick from
  const { data: casesData } = useQuery({
    queryKey: ['staffNotFoundSelect'],
    queryFn: () => getStaffNotFoundCases({ page: 1, pageSize: 50 })
  });

  // Fetch available found items to pick from if student found their item
  const { data: itemsData } = useQuery({
    queryKey: ['availableItemsSelect'],
    queryFn: () => getFoundItems({ page: 1, pageSize: 100, status: 'AVAILABLE' })
  });

  const selectedReport = casesData?.data?.find(c => String(c.reportId) === String(selectedReportId));

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      await recordRoomVisit({
        reportId: parseInt(selectedReportId, 10),
        manualSearchResult,
        foundId: manualSearchResult === 'FOUND_ITEM' ? parseInt(selectedFoundId, 10) : undefined,
        cctvChecked: manualSearchResult === 'NOT_FOUND' ? cctvChecked : false,
        cctvOutcome: manualSearchResult === 'NOT_FOUND' && cctvChecked ? cctvOutcome : undefined,
        notes: notes || undefined
      });

      toast.success('Room visit and outcome successfully logged!');
      navigate('/staff/not-found');
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedReportId) {
      toast.error('Please select a student lost report.');
      return;
    }
    if (manualSearchResult === 'FOUND_ITEM' && !selectedFoundId) {
      toast.error('Please select the found item that was identified.');
      return;
    }

    if (manualSearchResult === 'NOT_FOUND' && cctvChecked && cctvOutcome === 'THEFT_SUSPECTED') {
      setTheftConfirmOpen(true);
      return;
    }

    handleFinalSubmit();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Record Room Visit & CCTV Outcome</h1>
          <p className="text-xs text-slate-400">
            Document a student's in-person physical search in SJT G03 and any CCTV footage reviews.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6"
      >
        {/* Step 1: Select Student Report */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            1. Select Student Lost Report *
          </label>
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">Select NOT_FOUND Case</option>
            {casesData?.data?.map((c) => (
              <option key={c.reportId} value={c.reportId}>
                #{c.reportId} - {c.studentName} ({c.regNo}) · {c.categoryName} ({c.roomName})
              </option>
            ))}
          </select>
        </div>

        {selectedReport && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1">
            <span className="font-bold text-slate-700 block">Report Summary:</span>
            <p className="text-slate-600">{selectedReport.description}</p>
            <span className="text-slate-400 block pt-1">
              Lost in: {selectedReport.roomName}
            </span>
          </div>
        )}

        {/* Step 2: Physical Room Search Result */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            2. In-Person Room Search Result in SJT G03 *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setManualSearchResult('NOT_FOUND')}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                manualSearchResult === 'NOT_FOUND'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm ring-1 ring-amber-400'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xs font-bold">Item NOT Found in Room</span>
              <span className="text-[11px] text-slate-500 mt-1">Student checked shelves and did not locate item</span>
            </button>

            <button
              type="button"
              onClick={() => setManualSearchResult('FOUND_ITEM')}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                manualSearchResult === 'FOUND_ITEM'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm ring-1 ring-emerald-400'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xs font-bold">Item Identified on Shelf!</span>
              <span className="text-[11px] text-slate-500 mt-1">Student spotted item in storage</span>
            </button>
          </div>
        </div>

        {/* If FOUND_ITEM: Select the found item */}
        {manualSearchResult === 'FOUND_ITEM' && (
          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2 animate-in fade-in">
            <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Select Located Shelf Inventory Item *
            </label>
            <select
              value={selectedFoundId}
              onChange={(e) => setSelectedFoundId(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Item from Shelf</option>
              {itemsData?.data?.map((i) => (
                <option key={i.foundId} value={i.foundId}>
                  Tag [{i.shelfCode}] - {i.category?.categoryName}: {i.description}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-emerald-700">
              Selecting this item creates an automatic 100-score match and reassigns case to reviewer.
            </p>
          </div>
        )}

        {/* Step 3: CCTV Review (Only if NOT_FOUND) */}
        {manualSearchResult === 'NOT_FOUND' && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="cctvChecked"
                checked={cctvChecked}
                onChange={(e) => setCctvChecked(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <label htmlFor="cctvChecked" className="text-xs font-bold text-slate-700 cursor-pointer">
                Student requested in-person CCTV footage verification
              </label>
            </div>

            {cctvChecked && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  CCTV Investigation Outcome *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCctvOutcome('LOCATED')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition ${
                      cctvOutcome === 'LOCATED'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Item Located
                  </button>

                  <button
                    type="button"
                    onClick={() => setCctvOutcome('NOT_VISIBLE')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition ${
                      cctvOutcome === 'NOT_VISIBLE'
                        ? 'bg-slate-200 border-slate-400 text-slate-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Not Visible (Close)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCctvOutcome('THEFT_SUSPECTED')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition ${
                      cctvOutcome === 'THEFT_SUSPECTED'
                        ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Theft Suspected
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staff Observations & Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Staff Observation Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add relevant notes regarding the student's visit, exact racks searched, or CCTV camera timestamps..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
          >
            {submitting ? 'Recording Visit...' : 'Save Visit Record'}
          </button>
        </div>
      </form>

      {/* Confirmation modal for THEFT_SUSPECTED */}
      <ConfirmDialog
        isOpen={theftConfirmOpen}
        onClose={() => setTheftConfirmOpen(false)}
        onConfirm={() => {
          setTheftConfirmOpen(false);
          handleFinalSubmit();
        }}
        title="Forward Case for Theft Tracking?"
        message="Recording THEFT_SUSPECTED will immediately update report status to THEFT_FORWARDED and create a formal tracking assignment for the designated university theft handler."
        confirmText="Confirm Theft Forwarding"
        isDestructive={true}
      />
    </div>
  );
}
