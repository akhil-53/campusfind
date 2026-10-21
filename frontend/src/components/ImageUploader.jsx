import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export function ImageUploader({ images, onChange, maxFiles = 3, maxSizeBytes = 3 * 1024 * 1024 }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    if (images.length + selectedFiles.length > maxFiles) {
      toast.error(`You can only upload up to ${maxFiles} photos.`);
      return;
    }

    const validFiles = [];
    for (const file of selectedFiles) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error(`${file.name}: Only JPEG, PNG, or WebP allowed.`);
        continue;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`${file.name}: File size exceeds 3 MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    onChange([...images, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = (index) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((file, idx) => (
          <div
            key={idx}
            className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-sm"
          >
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition opacity-90 group-hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {images.length < maxFiles && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-500 bg-slate-50/60 hover:bg-brand-50/30 flex flex-col items-center justify-center text-slate-500 hover:text-brand-600 transition"
          >
            <Upload className="w-5 h-5 mb-1" />
            <span className="text-[11px] font-medium">Add Photo</span>
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
      />
      <p className="text-xs text-slate-400">
        Max {maxFiles} photos (JPEG, PNG, WebP up to 3MB each).
      </p>
    </div>
  );
}
