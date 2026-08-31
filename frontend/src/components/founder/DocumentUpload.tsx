'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { IP_DOCUMENT_TYPES } from '@/lib/ipTypes';

const MAX_MB = 10;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx';

export interface UploadedDocument {
  id?: string;
  fileUrl: string;
  fileName: string;
  documentType: string;
}

/**
 * Supporting files for an IP record. Same direct browser → Cloudinary path as
 * LogoUpload and VideoUpload — the backend only mints a signature, the file
 * never touches our server — but uploaded as Cloudinary's `raw` resource type,
 * which is what a PDF needs.
 *
 * These files are never shown on the public registry. The wording below says
 * so plainly, because a founder deciding whether to attach a filing draft
 * needs to know that before they pick the file, not after.
 */
export default function DocumentUpload({
  documents,
  onAdd,
  onRemove,
  disabled = false,
}: {
  documents: UploadedDocument[];
  onAdd: (doc: UploadedDocument) => void | Promise<void>;
  onRemove: (doc: UploadedDocument, index: number) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [failed, setFailed] = useState('');
  const [docType, setDocType] = useState('OTHER');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setFailed('');
    if (file.size > MAX_MB * 1024 * 1024) {
      setFailed(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    setPct(0);
    let sig: any;
    try {
      sig = await api.getDocumentUploadSignature();
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
    // resourceType comes from the signature response — 'raw' for documents.
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType || 'raw'}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = async () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const url = JSON.parse(xhr.responseText).secure_url;
          await onAdd({ fileUrl: url, fileName: file.name, documentType: docType });
        } catch {
          setFailed('Upload finished but the response was unreadable.');
        }
      } else {
        let msg = 'Upload failed. Please try again.';
        try {
          msg = JSON.parse(xhr.responseText)?.error?.message || msg;
        } catch {
          /* keep default */
        }
        setFailed(msg);
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setFailed('Upload failed — check your connection.');
    };
    xhr.send(form);
  };

  return (
    <div>
      {documents.length > 0 && (
        <ul className="space-y-2 mb-3">
          {documents.map((doc, i) => (
            <li
              key={doc.id ?? `${doc.fileUrl}-${i}`}
              className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
            >
              <span className="text-lg shrink-0">📄</span>
              <div className="min-w-0 flex-1">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-800 hover:text-blue-700 truncate block"
                >
                  {doc.fileName}
                </a>
                <p className="text-xs text-slate-400">
                  {IP_DOCUMENT_TYPES.find((t) => t.value === doc.documentType)?.label ?? 'Other'}
                </p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(doc, i)}
                  className="text-xs text-red-600 hover:underline shrink-0"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          disabled={disabled || uploading}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
        >
          {IP_DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:border-blue-300 hover:text-blue-700 transition disabled:opacity-60"
        >
          {uploading ? `Uploading ${pct}%` : 'Attach a file'}
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        PDF, image or Word · up to {MAX_MB}MB.{' '}
        <span className="text-slate-500 font-medium">
          Files are never shown on the public registry — only you and the review team can open them.
        </span>
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = '';
        }}
      />
      {failed && <p className="text-xs text-red-600 mt-2 font-medium">{failed}</p>}
    </div>
  );
}
