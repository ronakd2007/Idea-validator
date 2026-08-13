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
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

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

  // Copies the PNG itself (not the link) so it pastes as an image into chats,
  // emails and docs. Needs the async Clipboard API with image support — absent
  // there (e.g. older Firefox), the Download button remains the fallback.
  const copyImage = async () => {
    if (!dataUrl) return;
    setCopyError('');
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('unsupported');
      }
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copying images isn't supported in this browser — use Download instead.");
    }
  };

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

        {copyError && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3 text-left">{copyError}</p>}

        <div className="flex gap-2 mt-5">
          <a
            href={dataUrl || undefined}
            download={filename}
            aria-disabled={!dataUrl}
            className={`flex-1 text-sm px-3 py-2.5 rounded-lg font-semibold text-center ${dataUrl ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}
          >
            Download PNG
          </a>
          <button
            onClick={copyImage}
            disabled={!dataUrl}
            className="flex-1 text-sm bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-lg font-semibold hover:border-slate-300 disabled:opacity-50"
          >
            {copied ? 'Copied!' : 'Copy Image'}
          </button>
          <button onClick={onClose} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-lg hover:border-slate-300">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
