import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyLetterCode } from '../api/client';
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Calendar, Tag, CheckCheck } from 'lucide-react';
import dayjs from 'dayjs';

export function VerifyLetter() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function verify() {
      setLoading(true);
      setError(false);
      try {
        const res = await verifyLetterCode(code);
        setData(res);
      } catch (err) {
        setError(true);
      }
      setLoading(false);
    }
    if (code) verify();
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-slate-900 px-6 py-6 text-center text-white relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 mb-3 border border-brand-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">CampusFind Letter Verification</h1>
          <p className="text-xs text-slate-400 mt-1">SJT Block Lost and Found Cell · VIT Vellore</p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400">Verifying security certificate...</p>
            </div>
          ) : error || !data?.valid ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Invalid Document</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
                No authentic handover letter matched code <span className="font-mono font-bold text-slate-700">{code}</span>. Please verify the physical stamp at SJT G03.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                  Verified Official Document
                </span>
                <h2 className="text-2xl font-mono font-extrabold text-slate-900">
                  {data.letterNo}
                </h2>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-1.5" /> Item Category
                  </span>
                  <span className="font-semibold text-slate-800">{data.category}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> Generated On
                  </span>
                  <span className="font-semibold text-slate-800">
                    {dayjs(data.generatedAt).format('DD MMM YYYY, hh:mm A')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 flex items-center">
                    <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Physical Handover
                  </span>
                  <span className={`font-semibold ${data.handedOverAt ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {data.handedOverAt ? 'Completed' : 'Pending Counter Collection'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Security notice: In compliance with university privacy regulations, student and reviewer identity credentials are not publicly exposed.
              </p>
            </div>
          )}

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <Link
              to="/login"
              className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to CampusFind Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
