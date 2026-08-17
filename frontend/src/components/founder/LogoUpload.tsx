'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

const MAX_MB = 5;

// Square-image sibling of VideoUpload: same direct browser → Cloudinary path
// (backend only mints a signature), sized and framed for a startup logo.
export default function LogoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [failed, setFailed] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setFailed('');
    if (!file.type.startsWith('image/')) {
      setFailed('Choose an image file (PNG, JPG or SVG).');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFailed(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    setPct(0);
    let sig: any;
    try {
      sig = await api.getImageUploadSignature();
    } catch (err: any) {
      setUploading(false);
      setFailed(err.message || 'Could not start the upload.');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { onChange(JSON.parse(xhr.responseText).secure_url); }
        catch { setFailed('Upload finished but the response was unreadable.'); }
      } else {
        let msg = 'Upload failed. Please try again.';
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch { /* keep default */ }
        setFailed(msg);
      }
    };
    xhr.onerror = () => { setUploading(false); setFailed('Upload failed — check your connection.'); };
    xhr.send(form);
  };

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Startup logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-slate-300">🏢</span>
          )}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:border-blue-300 hover:text-blue-700 transition disabled:opacity-60"
          >
            {uploading ? `Uploading ${pct}%` : value ? 'Change logo' : 'Upload logo'}
          </button>
          {value && !uploading && (
            <button type="button" onClick={() => onChange('')} className="ml-2 text-xs text-red-600 hover:underline">
              Remove
            </button>
          )}
          <p className="text-xs text-slate-400 mt-1.5">Square works best · PNG or JPG · up to {MAX_MB}MB</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      {failed && <p className="text-xs text-red-600 mt-2 font-medium">{failed}</p>}
    </div>
  );
}
