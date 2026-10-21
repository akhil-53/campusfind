import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getMeta, createReport } from '../../api/client';
import { FilePlus, ShieldAlert, Info, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const reportSchema = z.object({
  categoryId: z.coerce.number().min(1, 'Category is required'),
  locationId: z.coerce.number().min(1, 'Location room is required'),
  description: z.string().min(10, 'Minimum 10 characters').max(300, 'Max 300 characters'),
  color: z.string().max(30).optional().or(z.literal('')),
  brand: z.string().max(40).optional().or(z.literal('')),
  identifyingMarks: z.string().min(5, 'Minimum 5 characters').max(1000, 'Max 1000 characters'),
  lostFromDate: z.string().min(1, 'Lost from date is required'),
  lostFromTime: z.string().min(1, 'Lost from time is required'),
  lostToDate: z.string().min(1, 'Lost to date is required'),
  lostToTime: z.string().min(1, 'Lost to time is required')
}).superRefine((data, ctx) => {
  // Build local datetimes from separate date and time fields.
  const from = new Date(`${data.lostFromDate}T${data.lostFromTime}`);
  const to = new Date(`${data.lostToDate}T${data.lostToTime}`);

  if (
    !data.lostFromDate || !data.lostFromTime ||
    !data.lostToDate || !data.lostToTime ||
    Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())
  ) {
    return;
  }

  if (to < from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lost To cannot be earlier than Lost From',
      path: ['lostToTime']
    });
    return;
  }

  const diffHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  if (diffHours > 24) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lost time range cannot exceed 24 hours',
      path: ['lostToTime']
    });
  }


});

export function NewReport() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: metaData } = useQuery({
    queryKey: ['meta'],
    queryFn: getMeta
  });

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(reportSchema)
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const { lostFromDate, lostFromTime, lostToDate, lostToTime, ...otherValues } = values;
      const lostFrom = new Date(`${lostFromDate}T${lostFromTime}`);
      const lostTo = new Date(`${lostToDate}T${lostToTime}`);

      const res = await createReport({
        ...otherValues,
        lostFrom: lostFrom.toISOString(),
        lostTo: lostTo.toISOString()
      });
      toast.success('Lost report submitted! Our review team has been notified.');
      navigate(`/student/reports/${res.report.reportId}`);
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
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
          <h1 className="text-2xl font-bold text-slate-800">File a Lost Item Report</h1>
          <p className="text-xs text-slate-400">
            Provide accurate details so our system can calculate match likelihood.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6"
      >
        {/* Category & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Item Category *
            </label>
            <select
              {...register('categoryId')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Select Category</option>
              {metaData?.categories?.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-rose-500 mt-1">{errors.categoryId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Room / Location *
            </label>
            <select
              {...register('locationId')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Select Room</option>
              {metaData?.locations?.map((l) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.block} - {l.roomName} ({l.locationType})
                </option>
              ))}
            </select>
            {errors.locationId && (
              <p className="text-xs text-rose-500 mt-1">{errors.locationId.message}</p>
            )}
          </div>
        </div>

        {/* Lost date and time: separate inputs prevent browser datetime-local format issues */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Lost From (Estimated) *
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  {...register('lostFromDate')}
                  className="w-full min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.lostFromDate && (
                  <p className="text-xs text-rose-500 mt-1">{errors.lostFromDate.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  {...register('lostFromTime')}
                  className="w-full min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.lostFromTime && (
                  <p className="text-xs text-rose-500 mt-1">{errors.lostFromTime.message}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Lost To (Maximum 24-hour Window) *
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  {...register('lostToDate')}
                  className="w-full min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.lostToDate && (
                  <p className="text-xs text-rose-500 mt-1">{errors.lostToDate.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  {...register('lostToTime')}
                  className="w-full min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.lostToTime && (
                  <p className="text-xs text-rose-500 mt-1">{errors.lostToTime.message}</p>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Select the date and time separately. The lost time range must be no longer than 24 hours and cannot end in the future.
          </p>
        </div>

        {/* General Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            General Description (10–300 chars) *
          </label>
          <textarea
            rows={3}
            {...register('description')}
            placeholder="e.g. Black stainless steel Milton water bottle with a silver cap..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.description && (
            <p className="text-xs text-rose-500 mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Color & Brand */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Color
            </label>
            <input
              type="text"
              {...register('color')}
              placeholder="e.g. Matte Black / Silver"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Brand / Manufacturer
            </label>
            <input
              type="text"
              {...register('brand')}
              placeholder="e.g. Milton / Apple / Dell"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Identifying Marks (CONFIDENTIAL) */}
        <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 space-y-2">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                Identifying Marks & Confidential Proof *
              </label>
              <p className="text-xs text-amber-700">
                Only the verifying faculty will see this during your physical verification appointment. Staff and other students will never see this.
              </p>
            </div>
          </div>

          <textarea
            rows={3}
            {...register('identifyingMarks')}
            placeholder="Describe specific scratches, stickers, serial numbers, wallpapers, engraving, or specific contents..."
            className="w-full px-4 py-2.5 rounded-xl border border-amber-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {errors.identifyingMarks && (
            <p className="text-xs text-rose-500 mt-1">{errors.identifyingMarks.message}</p>
          )}
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
            {submitting ? 'Submitting...' : 'Submit Lost Report'}
          </button>
        </div>
      </form>
    </div>
  );
}
