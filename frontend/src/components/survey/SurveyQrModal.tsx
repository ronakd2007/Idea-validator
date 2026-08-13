'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Full-screen QR code for a survey's public link — built for showing across a
 * table or dropping onto a poster. The PNG is generated client-side at 800px
 * so the downloaded file stays sharp in print; nothing is sent to any
 * third-party QR service.
 */
export default function SurveyQrModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 800,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => setError('Could not generate the QR code.'));
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filename = `${(title || 'survey').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'survey'}-qr.png`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`QR code for ${title}`}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-slate-900 text-left truncate pr-3">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0">×</button>
        </div>
        <p className="text-xs text-slate-500 text-left mb-4">Point a phone camera at the code to open the survey.</p>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>}
        {!error && (dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URI, next/image adds nothing here
          <img src={dataUrl} alt={`QR code linking to ${url}`} className="w-64 h-64 mx-auto rounded-lg border border-slate-200" />
        ) : (
          <div className="w-64 h-64 mx-auto rounded-lg border border-slate-200 flex items-center justify-center text-sm text-slate-400">Generating…</div>
        ))}

        <p className="text-xs text-slate-400 mt-3 break-all">{url}</p>

        <div className="flex gap-2 mt-5">
          <a
            href={dataUrl || undefined}
            download={filename}
            aria-disabled={!dataUrl}
            className={`flex-1 text-sm px-4 py-2.5 rounded-lg font-semibold text-center ${dataUrl ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}
          >
            Download PNG
          </a>
          <button onClick={onClose} className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg hover:border-slate-300">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
