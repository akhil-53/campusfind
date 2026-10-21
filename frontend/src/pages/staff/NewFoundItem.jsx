import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getMeta, logFoundItem } from '../../api/client';
import { ImageUploader } from '../../components/ImageUploader';
import { PackagePlus, ArrowLeft, CheckCircle2, Tag, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

const foundItemSchema = z.object({
  categoryId: z.coerce.number().min(1, 'Category is required'),
  locationId: z.coerce.number().min(1, 'Found room location is required'),
  description: z.string().min(3, 'Minimum 3 characters').max(200, 'Max 200 characters'),
  color: z.string().max(30).optional().or(z.literal('')),
  brand: z.string().max(40).optional().or(z.literal('')),
  shelfCode: z.string().min(2, 'Shelf code is required (e.g. SH-A01)').max(20),
  foundAt: z.string().nonempty('Found time is required')
}).refine((data) => {
  const found = new Date(data.foundAt);
  return found <= new Date(Date.now() + 5 * 60 * 1000);
}, {
  message: 'Found time cannot be in the future',
  path: ['foundAt']
});

export function NewFoundItem() {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdItem, setCreatedItem] = useState(null);

  const { data: metaData } = useQuery({
    queryKey: ['meta'],
    queryFn: getMeta
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(foundItemSchema),
    defaultValues: {
      shelfCode: `SH-${String.fromCharCode(65 + Math.floor(Math.random() * 6))}${String(Math.floor(Math.random() * 89) + 10)}`,
      foundAt: new Date().toISOString().slice(0, 16)
    }
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('categoryId', values.categoryId);
      formData.append('locationId', values.locationId);
      formData.append('description', values.description);
      if (values.color) formData.append('color', values.color);
      if (values.brand) formData.append('brand', values.brand);
      formData.append('shelfCode', values.shelfCode.trim().toUpperCase());
      formData.append('foundAt', new Date(values.foundAt).toISOString());

      images.forEach((file) => {
        formData.append('images', file);
      });

      const res = await logFoundItem(formData);
      setCreatedItem(res.item);
      toast.success('Found item logged successfully!');
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  // If item was created, show prominent shelf code card as per spec
  if (createdItem) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              PHYSICAL SHELF LABEL TAG
            </span>
            <div className="p-4 bg-slate-900 text-white rounded-2xl font-mono text-3xl font-extrabold tracking-widest flex items-center justify-center gap-3">
              <Tag className="w-6 h-6 text-brand-400" />
              <span>{createdItem.shelfCode}</span>
            </div>
            <p className="text-xs text-slate-500 pt-2">
              Write this code clearly on the physical item tag before placing it on the designated SJT G03 storage rack.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                setCreatedItem(null);
                setImages([]);
              }}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              Log Another Found Item
            </button>
            <Link
              to="/staff/items"
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              View All Inventory
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-slate-800">Log Found Item</h1>
          <p className="text-xs text-slate-400">
            Record items handed in by security, housekeeping, or students at SJT G03.
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
              Category *
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
              Room Found In *
            </label>
            <select
              {...register('locationId')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Select Room</option>
              {metaData?.locations?.map((l) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.block} - {l.roomName}
                </option>
              ))}
            </select>
            {errors.locationId && (
              <p className="text-xs text-rose-500 mt-1">{errors.locationId.message}</p>
            )}
          </div>
        </div>

        {/* Shelf Code & Found At */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Shelf Rack Code (Format: SH-A01) *
            </label>
            <input
              type="text"
              {...register('shelfCode')}
              placeholder="e.g. SH-A01"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.shelfCode && (
              <p className="text-xs text-rose-500 mt-1">{errors.shelfCode.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Found Date & Time *
            </label>
            <input
              type="datetime-local"
              {...register('foundAt')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.foundAt && (
              <p className="text-xs text-rose-500 mt-1">{errors.foundAt.message}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Generic Description (3–200 chars) *
          </label>
          <textarea
            rows={2}
            {...register('description')}
            placeholder="e.g. Blue plastic umbrella with curved handle..."
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
              placeholder="e.g. Black / Blue"
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
              placeholder="e.g. Milton / Casio"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Photos Upload */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Item Photos (1–3 Photos)
          </label>
          <ImageUploader images={images} onChange={setImages} maxFiles={3} />
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
            {submitting ? 'Registering Item...' : 'Save & Print Shelf Tag'}
          </button>
        </div>
      </form>
    </div>
  );
}
