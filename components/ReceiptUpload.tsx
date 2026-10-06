'use client';

import { useRef, useState } from 'react';
import { FileImage, FileText, UploadCloud, X } from 'lucide-react';

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.pdf';

export interface ReceiptFileState {
  file: File | null;
  error: string | null;
}

export function ReceiptUpload({
  value,
  onChange,
  maxBytes = 5 * 1024 * 1024,
  disabled = false,
}: {
  value: ReceiptFileState;
  onChange: (next: ReceiptFileState) => void;
  maxBytes?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function validate(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) {
      return 'Unsupported file type. Upload a JPG, PNG, WEBP or PDF file.';
    }
    if (file.size > maxBytes) {
      return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum is ${Math.floor(
        maxBytes / (1024 * 1024),
      )}MB.`;
    }
    if (file.size === 0) return 'That file appears to be empty.';
    return null;
  }

  function accept(file: File | undefined) {
    if (!file) return;
    const error = validate(file);
    onChange({ file: error ? null : file, error });
  }

  const isPdf = value.file?.type === 'application/pdf';

  return (
    <div>
      <label className="label">Payment receipt</label>

      {value.file ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-300">
            {isPdf ? <FileText className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{value.file.name}</p>
            <p className="text-[11px] text-slate-500">
              {(value.file.size / 1024).toFixed(0)} KB · ready to upload
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({ file: null, error: null });
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Remove receipt"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files?.[0]);
          }}
          disabled={disabled}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition ${
            dragging
              ? 'border-brand-400/60 bg-brand-500/10'
              : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
          }`}
        >
          <UploadCloud className="h-6 w-6 text-slate-400" />
          <span className="text-sm font-medium text-white">
            Drop your receipt here, or click to browse
          </span>
          <span className="text-[11px] text-slate-500">
            JPG, PNG, WEBP or PDF · max {Math.floor(maxBytes / (1024 * 1024))}MB
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => accept(event.target.files?.[0])}
        disabled={disabled}
      />

      {value.error ? <p className="mt-1.5 text-xs text-danger-400">{value.error}</p> : null}
    </div>
  );
}
