'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

const MAX_MB = 200;
const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-msvideo'];

// Direct browser → Cloudinary upload. The backend only mints a short-lived
// signature; the file itself never touches our server (Render's free tier
// couldn't hold a 200MB video in memory anyway).
//
// XMLHttpRequest rather than fetch() purely for upload progress — fetch still
// has no way to report how far a request body has been sent.
export default function VideoUpload({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (url: string) => void;
  error?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [failed, setFailed] = useState('');
  const [fileName, setFileName] = useState('');
  const [showLink, setShowLink] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const pick = () => inputRef.current?.click();

  const upload = async (file: File) => {
    setFailed('');
    if (!ACCEPTED.includes(file.type) && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
      setFailed('That file type isn\'t supported. Use MP4, MOV, WEBM, MKV or AVI.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFailed(`That video is ${(file.size / 1024 / 1024).toFixed(0)}MB — the limit is ${MAX_MB}MB. Try a shorter clip or a lower recording quality.`);
      return;
    }

    setFileName(file.name);
    setUploading(true);
    setPct(0);

    let sig: any;
    try {
      sig = await api.getVideoUploadSignature();
    } catch (err: any) {
      setUploading(false);
      setFailed(err.message || 'Could not start the upload. Please try again.');
      setShowLink(true);
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          onChange(res.secure_url);
        } catch {
          setFailed('Upload finished but the response was unreadable. Please try again.');
        }
      } else {
        let msg = 'Upload failed. Please try again.';
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch { /* keep default */ }
        setFailed(msg);
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      xhrRef.current = null;
      setFailed('Upload failed — check your internet connection and try again.');
    };
    xhr.onabort = () => { setUploading(false); xhrRef.current = null; setPct(0); };
    xhr.send(form);
  };

  const cancel = () => xhrRef.current?.abort();

  const remove = () => {
    onChange('');
    setFileName('');
    setPct(0);
    setFailed('');
  };

  // ---- uploaded ----
  if (value && !uploading) {
    return (
      <div>
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">✓ Video added</p>
              <p className="text-xs text-slate-500 mt-0.5 break-all">{fileName || value}</p>
            </div>
            <button type="button" onClick={remove} className="text-xs text-red-600 hover:underline font-medium shrink-0">
              Remove
            </button>
          </div>
          {/* Cloudinary serves a playable file, so the founder can confirm the
              right video uploaded before submitting. */}
          {/^https?:\/\/res\.cloudinary\.com\//.test(value) && (
            <video src={value} controls preload="metadata" className="w-full rounded-md mt-3 max-h-64 bg-black" />
          )}
        </div>
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
    );
  }

  // ---- uploading ----
  if (uploading) {
    return (
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm text-slate-700 truncate">Uploading {fileName}…</p>
          <button type="button" onClick={cancel} className="text-xs text-slate-500 hover:text-slate-700 shrink-0">Cancel</button>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-1.5 tabular-nums">{pct}%{pct === 100 ? ' — processing…' : ''}</p>
      </div>
    );
  }

  // ---- empty ----
  return (
    <div>
      <button
        type="button"
        onClick={pick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className={`w-full border-2 border-dashed rounded-lg px-4 py-7 text-center transition hover:border-blue-400 hover:bg-blue-50/30 ${
          error || failed ? 'border-red-300 bg-red-50/40' : 'border-slate-300'
        }`}
      >
        <span className="block text-2xl mb-1.5">🎬</span>
        <span className="block text-sm font-semibold text-slate-800">Choose a video file</span>
        <span className="block text-xs text-slate-500 mt-1">or drag it here · MP4, MOV, WEBM · up to {MAX_MB}MB</span>
      </button>
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />

      {failed && <p className="text-xs text-red-600 mt-1.5 font-medium">{failed}</p>}

      {/* Escape hatch: founders who already have the pitch on YouTube/Loom
          shouldn't have to re-upload it, and this also keeps the form usable
          if Cloudinary is unreachable. */}
      {showLink ? (
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">Or paste a video link</label>
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            defaultValue={value}
            onChange={(e) => onChange(e.target.value.trim())}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
          />
        </div>
      ) : (
        <button type="button" onClick={() => setShowLink(true)} className="text-xs text-blue-600 hover:underline mt-2">
          Already have it on YouTube or Loom? Paste a link instead
        </button>
      )}
    </div>
  );
}
