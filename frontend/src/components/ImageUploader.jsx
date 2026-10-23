import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function ImageUploader({
  images = [],
  onChange,
  maxFiles = 3,
  maxSizeBytes = 3 * 1024 * 1024,
  label = 'Add Photo',
  hint = 'or drop here'
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (selectedFiles) => {
    if (!selectedFiles || !selectedFiles.length) return;

    if (images.length + selectedFiles.length > maxFiles) {
      toast.error(`You can only upload up to ${maxFiles} photos.`);
      return;
    }

    const validFiles = [];
    for (const file of selectedFiles) {
      const isImg = file.type?.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
      if (!isImg) {
        toast.error(`${file.name}: Only image files (JPEG, PNG, WebP) are allowed.`);
        continue;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`${file.name}: File size exceeds 3 MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onChange([...images, ...validFiles]);
    }
  };

  const handleFileChange = (e) => {
    processFiles(Array.from(e.target.files || []));
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemove = (index) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {images.map((file, idx) => (
          <div
            key={idx}
            className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-sm transition hover:shadow-md"
          >
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(idx);
              }}
              className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-full transition shadow-sm z-10"
              title="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1 text-[9px] text-white text-center font-mono truncate">
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
        ))}

        {images.length < maxFiles && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleClick(e);
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-24 h-24 rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center transition select-none active:scale-95 ${
              isDragging
                ? 'border-brand-500 bg-brand-50 text-brand-600 scale-105'
                : 'border-slate-300 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/40 text-slate-500 hover:text-brand-600'
            }`}
          >
            <Upload className="w-5 h-5 mb-1 pointer-events-none" />
            <span className="text-[11px] font-bold pointer-events-none">{label}</span>
            <span className="text-[9px] text-slate-400 mt-0.5 pointer-events-none">{hint}</span>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="image/*,.jpg,.jpeg,.png,.webp"
              multiple
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Max {maxFiles} photos (JPEG, PNG, WebP up to 3MB each). Click or drag & drop to upload.
      </p>
    </div>
  );
}
