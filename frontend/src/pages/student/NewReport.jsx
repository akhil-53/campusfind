import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getMeta, createReport } from '../../api/client';
import { ImageUploader } from '../../components/ImageUploader';
import { FilePlus, ShieldAlert, Clock, Tag, Palette, ArrowLeft, Info, MapPin, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Schema: date + start time + end time (on the same day; max 24h gap) ──
const reportSchema = z.object({
  categoryId: z.coerce.number().min(1, 'Category is required'),
  categoryCustom: z.string().max(80).optional().or(z.literal('')),
  locationText: z.string().min(2, 'Please enter a room number or location').max(200, 'Max 200 characters'),
  description: z.string().min(10, 'Minimum 10 characters').max(300, 'Max 300 characters'),
  color: z.string().max(30).optional().or(z.literal('')),
  brand: z.string().max(40).optional().or(z.literal('')),
  identifyingMarks: z.string().min(5, 'Minimum 5 characters').max(1000, 'Max 1000 characters'),
  lostDate: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
}).superRefine((data, ctx) => {
  if (!data.lostDate || !data.startTime || !data.endTime) return;

  const from = new Date(`${data.lostDate}T${data.startTime}`);
  const to = new Date(`${data.lostDate}T${data.endTime}`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return;

  if (to <= from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time',
      path: ['endTime'],
    });
    return;
  }

  const diffHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  if (diffHours > 24) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Interval cannot exceed 24 hours',
      path: ['endTime'],
    });
  }

  if (to > new Date(Date.now() + 5 * 60 * 1000)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time cannot be in the future',
      path: ['endTime'],
    });
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
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [images, setImages] = useState([]);

  const { data: metaData } = useQuery({ queryKey: ['meta'], queryFn: getMeta });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(reportSchema),
    defaultValues: { lostDate: new Date().toISOString().slice(0, 10) }
  });

  const selectedCategoryId = watch('categoryId');
  const selectedCategory = metaData?.categories?.find(
    (c) => String(c.categoryId) === String(selectedCategoryId)
  );
  const isOtherCategory = selectedCategory?.categoryName?.toLowerCase() === 'other';

  // Smart-suggest known rooms as user types
  const filteredLocations = (metaData?.locations || []).filter((l) => {
    const q = locationQuery.toLowerCase();
    return (
      l.roomName?.toLowerCase().includes(q) ||
      l.block?.toLowerCase().includes(q) ||
      l.locationType?.toLowerCase().includes(q)
    );
  }).slice(0, 6);

  const handleLocationSelect = (loc) => {
    const label = `${loc.block} — ${loc.roomName}`;
    setValue('locationText', label, { shouldValidate: true });
    setLocationQuery(label);
    setShowLocationSuggestions(false);
  };

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const { lostDate, startTime, endTime, ...otherValues } = values;
      const lostFrom = new Date(`${lostDate}T${startTime}`).toISOString();
      const lostTo   = new Date(`${lostDate}T${endTime}`).toISOString();

      const formData = new FormData();
      formData.append('lostFrom', lostFrom);
      formData.append('lostTo', lostTo);
      Object.entries(otherValues).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, val);
        }
      });
      images.forEach((file) => {
        formData.append('images', file);
      });

      const res = await createReport(formData);
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

          {/* Category selector */}
          <Field label="Item Category" required error={errors.categoryId?.message}>
            <select {...register('categoryId')} className={selectCls}>
              <option value="">Select a category...</option>
              {metaData?.categories?.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
              ))}
            </select>
          </Field>

          {/* When "Other" is chosen, let student specify */}
          {isOtherCategory && (
            <Field
              label="Specify Item Type"
              required
              hint="Describe the item type since it doesn't fit any listed category."
              error={errors.categoryCustom?.message}
            >
              <input
                type="text"
                {...register('categoryCustom')}
                placeholder="e.g. Umbrella, Spectacles, Charger..."
                className={inputCls}
                autoFocus
              />
            </Field>
          )}

          {/* Location — free-text with smart autocomplete */}
          <Field
            label="Room Number / Location"
            required
            hint="Type your room number, corridor or area (e.g. SJT 312, Near SJT 418, Ground floor lobby)."
            error={errors.locationText?.message}
          >
            <div className="relative">
              <div className="relative flex items-center">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  {...register('locationText')}
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    setValue('locationText', e.target.value, { shouldValidate: true });
                    setShowLocationSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowLocationSuggestions(locationQuery.length > 0)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 150)}
                  placeholder="e.g. SJT 312, Near SJT 418, Ground Floor Lobby..."
                  className={`${inputCls} pl-10 pr-10`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowLocationSuggestions((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions dropdown */}
              {showLocationSuggestions && filteredLocations.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  <p className="text-xs text-slate-400 font-medium px-3 py-2 border-b border-slate-100 bg-slate-50">
                    Known rooms — click to fill, or just type your own
                  </p>
                  {filteredLocations.map((l) => (
                    <button
                      key={l.locationId}
                      type="button"
                      onMouseDown={() => handleLocationSelect(l)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>
                        <span className="font-semibold">{l.block} — {l.roomName}</span>
                        <span className="text-slate-400 text-xs ml-1.5">({l.locationType})</span>
                      </span>
                    </button>
                  ))}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      💡 You can type any custom location — no need to pick from the list.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Field>
        </Section>

        {/* ── Section 2: When Did You Lose It? ── */}
        <Section
          icon={Clock}
          title="When Did You Lose It?"
          subtitle="Pick the date and the time interval — maximum 24 hours."
          accent="slate"
        >
          {/* Single date row */}
          <Field label="Date" required error={errors.lostDate?.message}>
            <input
              type="date"
              {...register('lostDate')}
              max={new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </Field>

          {/* Time interval: start → end on same date */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Time Interval <span className="text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="From (start time)" error={errors.startTime?.message}>
                <input type="time" {...register('startTime')} className={inputCls} />
              </Field>
              <Field label="To (end time)" error={errors.endTime?.message}>
                <input type="time" {...register('endTime')} className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500">
              Both times must fall on the selected date. The interval cannot exceed 24 hours or end in the future.
            </p>
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
        {/* Photo Upload */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Photos (optional)
          </label>
          <ImageUploader images={images} onChange={setImages} maxFiles={3} />
        </div>

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
