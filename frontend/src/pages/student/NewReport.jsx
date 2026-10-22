import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getMeta, createReport } from '../../api/client';
import { FilePlus, ShieldAlert, Clock, Tag, Palette, ArrowLeft, Info } from 'lucide-react';
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
  const from = new Date(`${data.lostFromDate}T${data.lostFromTime}`);
  const to = new Date(`${data.lostToDate}T${data.lostToTime}`);

  if (
    !data.lostFromDate || !data.lostFromTime ||
    !data.lostToDate || !data.lostToTime ||
    Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())
  ) return;

  if (to < from) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Lost To cannot be earlier than Lost From', path: ['lostToTime'] });
    return;
  }
  const diffHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  if (diffHours > 24) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Lost time range cannot exceed 24 hours', path: ['lostToTime'] });
  }
});

/** Shared label + hint + error wrapper */
function Field({ label, required, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition hover:border-slate-300';

const selectCls =
  'w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition hover:border-slate-300 cursor-pointer';

/** Card section with icon header */
function Section({ icon: Icon, title, subtitle, accent = 'brand', children }) {
  const accentMap = {
    brand: 'bg-brand-50 text-brand-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-6 space-y-5">{children}</div>
    </div>
  );
}

export function NewReport() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: metaData } = useQuery({ queryKey: ['meta'], queryFn: getMeta });

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(reportSchema) });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const { lostFromDate, lostFromTime, lostToDate, lostToTime, ...otherValues } = values;
      const lostFrom = new Date(`${lostFromDate}T${lostFromTime}`);
      const lostTo = new Date(`${lostToDate}T${lostToTime}`);
      const res = await createReport({ ...otherValues, lostFrom: lostFrom.toISOString(), lostTo: lostTo.toISOString() });
      toast.success('Lost report submitted! Our review team has been notified.');
      navigate(`/student/reports/${res.report.reportId}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to submit. Please try again.');
      console.error(e);
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">File a Lost Item Report</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Accurate details improve match likelihood. Fields marked <span className="text-rose-500">*</span> are required.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Section 1: Item Details ── */}
        <Section icon={Tag} title="Item Details" subtitle="What did you lose and where?">
          <Field label="Item Category" required error={errors.categoryId?.message}>
            <select {...register('categoryId')} className={selectCls}>
              <option value="">Select a category...</option>
              {metaData?.categories?.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
              ))}
            </select>
          </Field>

          <Field label="Room / Location" required error={errors.locationId?.message}>
            <select {...register('locationId')} className={selectCls}>
              <option value="">Select the room where you lost it...</option>
              {metaData?.locations?.map((l) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.block} — {l.roomName} ({l.locationType})
                </option>
              ))}
            </select>
          </Field>
        </Section>

        {/* ── Section 2: Time Window ── */}
        <Section icon={Clock} title="When Did You Lose It?" subtitle="Narrow the window as much as possible — maximum 24 hours." accent="slate">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Lost from <span className="text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" error={errors.lostFromDate?.message}>
                <input type="date" {...register('lostFromDate')} className={inputCls} />
              </Field>
              <Field label="Time" error={errors.lostFromTime?.message}>
                <input type="time" {...register('lostFromTime')} className={inputCls} />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Lost to <span className="text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" error={errors.lostToDate?.message}>
                <input type="date" {...register('lostToDate')} className={inputCls} />
              </Field>
              <Field label="Time" error={errors.lostToTime?.message}>
                <input type="time" {...register('lostToTime')} className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500">The range must not exceed 24 hours and cannot end in the future.</p>
          </div>
        </Section>

        {/* ── Section 3: Description & Appearance ── */}
        <Section icon={Palette} title="Description & Appearance" subtitle="Help our system find a match in the found items inventory.">
          <Field
            label="General Description"
            required
            hint="10–300 characters. Include model, colour, and condition."
            error={errors.description?.message}
          >
            <textarea
              rows={3}
              {...register('description')}
              placeholder="e.g. Black stainless steel Milton water bottle with a silver screw cap, slight dents on the bottom..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition hover:border-slate-300 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Colour" hint="e.g. Matte Black / Silver" error={errors.color?.message}>
              <input type="text" {...register('color')} placeholder="Matte Black / Silver" className={inputCls} />
            </Field>
            <Field label="Brand / Make" hint="e.g. Milton, Apple, Dell" error={errors.brand?.message}>
              <input type="text" {...register('brand')} placeholder="Milton / Apple / Dell" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* ── Section 4: Confidential Proof ── */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
          <div className="flex items-start gap-3 px-6 py-4 border-b border-amber-200/70">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-900">
                Identifying Marks & Confidential Proof <span className="text-rose-500">*</span>
              </h2>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                <strong>Only the verifying faculty</strong> will see this during your physical verification.
                Staff and other students will never have access to this field.
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <textarea
              rows={4}
              {...register('identifyingMarks')}
              placeholder="Describe specific scratches, stickers, serial numbers, lock screen wallpaper, engraving, or unique contents inside..."
              className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-400/25 focus:border-amber-400 transition hover:border-amber-300 resize-none"
            />
            {errors.identifyingMarks && (
              <p className="text-xs text-rose-500 font-medium mt-1.5">{errors.identifyingMarks.message}</p>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-2">
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
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/25 transition disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-brand-500/30"
          >
            <FilePlus className="w-4 h-4" />
            {submitting ? 'Submitting…' : 'Submit Lost Report'}
          </button>
        </div>

      </form>
    </div>
  );
}
