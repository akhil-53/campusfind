import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReportById, withdrawReport, downloadHandoverPdf } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  FileCheck,
  AlertCircle,
  Download,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

export function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reportDetail', id],
    queryFn: () => getReportById(id)
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawReport(id),
    onSuccess: () => {
      toast.success('Report successfully withdrawn');
      queryClient.invalidateQueries(['reportDetail', id]);
      setWithdrawDialogOpen(false);
    }
  });

  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
        Loading report details...
      </div>
    );
  }

  const { report, upcomingVerification, handoverLetter, timeline } = data || {};
  if (!report) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-slate-400">REPORT #{report.reportId}</span>
              <StatusBadge status={report.status} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{report.category?.categoryName}</h1>
          </div>
        </div>

        {/* Withdraw Action */}
        {['OPEN', 'ASSIGNED'].includes(report.status) && (
          <button
            type="button"
            onClick={() => setWithdrawDialogOpen(true)}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition"
          >
            Withdraw Report
          </button>
        )}
      </div>

      {/* Verification Appointment Banner */}
      {report.status === 'VISIT_SCHEDULED' && upcomingVerification && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-purple-800 space-y-4">
          <div className="flex items-center space-x-2.5 text-purple-300">
            <UserCheck className="w-5 h-5 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Verification Visit Scheduled
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">
              Appointment at {upcomingVerification.venue}
            </h3>
            <p className="text-sm text-purple-200">
              Scheduled for{' '}
              <span className="font-semibold text-white">
                {dayjs(upcomingVerification.scheduledAt).format('dddd, DD MMMM YYYY, hh:mm A')}
              </span>
            </p>
          </div>
          <div className="inline-flex items-center bg-purple-800/60 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-200 border border-purple-700">
            <AlertCircle className="w-4 h-4 mr-1.5 text-purple-300" />
            IMPORTANT: Please carry your physical VIT Student ID Card.
          </div>
        </div>
      )}

      {/* Handover Completed Banner & PDF Download */}
      {report.status === 'RETURNED' && handoverLetter && (
        <div className="bg-emerald-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-emerald-300">
              <FileCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Item Verified & Returned</span>
            </div>
            <h3 className="text-lg font-bold">Handover Letter #{handoverLetter.letterNo}</h3>
            <p className="text-xs text-emerald-200">
              Security Code: <span className="font-mono font-bold text-white">{handoverLetter.verifyCode}</span>
            </p>
          </div>
          <button
            onClick={() => downloadHandoverPdf(handoverLetter.verificationId, handoverLetter.letterNo)}
            className="inline-flex items-center px-5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-bold text-xs shadow-md transition"
          >
            <Download className="w-4 h-4 mr-2" /> Download Handover PDF
          </button>
        </div>
      )}

      {/* NOT FOUND Room Visit Instructions */}
      {report.status === 'NOT_FOUND' && (
        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200/80 space-y-3">
          <div className="flex items-center space-x-2 text-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Item Not Found in Initial Match</h3>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Please visit the SJT Lost & Found Room (<strong>SJT G03</strong>) between 9:00 AM and 5:00 PM and search the inventory shelves in person with our staff. Remember to carry your Student ID.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-800">Report Information</h2>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Description
                </span>
                <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">Color</span>
                  <span className="font-medium text-slate-700">{report.color || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Brand / Make</span>
                  <span className="font-medium text-slate-700">{report.brand || 'Not specified'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs space-y-2">
                <div className="flex items-center text-slate-600">
                  <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                  <span>Room: <strong>{report.location?.block} - {report.location?.roomName}</strong></span>
                </div>
                <div className="flex items-center text-slate-600">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  <span>
                    Lost Between:{' '}
                    <strong>{dayjs(report.lostFrom).format('DD MMM, hh:mm A')}</strong> to{' '}
                    <strong>{dayjs(report.lostTo).format('DD MMM, hh:mm A')}</strong>
                  </span>
                </div>
              </div>

              {/* Identifying marks snapshot */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Your Claimed Identifying Marks (Confidential)
                </span>
                <p className="text-xs text-slate-700 italic">{report.identifyingMarks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Status Timeline */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm space-y-4 h-fit">
          <h2 className="text-base font-bold text-slate-800">Lifecycle Timeline</h2>
          <Timeline events={timeline} />
        </div>
      </div>

      {/* Confirm Withdraw Dialog */}
      <ConfirmDialog
        isOpen={withdrawDialogOpen}
        onClose={() => setWithdrawDialogOpen(false)}
        onConfirm={() => withdrawMutation.mutate()}
        loading={withdrawMutation.isPending}
        title="Withdraw Lost Report"
        message="Are you sure you want to withdraw this lost report? This action is permanent and will cancel ongoing review."
        confirmText="Yes, Withdraw Report"
      />
    </div>
  );
}
