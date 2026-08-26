'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import SurveyQrModal from '@/components/survey/SurveyQrModal';

const SECTION_TOGGLES: { key: string; label: string; hint: string }[] = [
  { key: 'showScores', label: 'Validation scores', hint: 'Overall score, expert score, customer %, risk level' },
  { key: 'showCounts', label: 'Evidence counts', hint: 'Number of validators and survey responses' },
  { key: 'showStrengthsRisks', label: 'Strengths & risks', hint: 'Top-rated and lowest-rated categories' },
  { key: 'showAiInsight', label: 'AI insight', hint: 'The verdict sentence from your AI summary' },
  { key: 'showProblem', label: 'Problem statement', hint: 'Your full problem description' },
  { key: 'showSolution', label: 'Solution description', hint: 'Your full solution' },
];

// Must stay in step with SHARE_DEFAULTS in the backend's ideas.service.ts —
// this is the fallback for an idea that has never been shared, so a mismatch
// would silently persist the wrong visibility on the founder's first save.
const SHARE_DEFAULTS: Record<string, boolean> = {
  showScores: true,
  showCounts: true,
  showStrengthsRisks: true,
  showAiInsight: true,
  showProblem: true,
  showSolution: true,
};

/**
 * Founder-facing control panel for the idea's public validation page.
 * Everything here maps 1:1 to the server-side whitelist — a section toggled
 * off is removed from the API response, not just hidden in CSS.
 */
export default function ShareIdeaModal({
  ideaId,
  ideaTitle,
  initialShare,
  onClose,
  onChanged,
}: {
  ideaId: string;
  ideaTitle: string;
  initialShare: { publicId: string | null; publicShareEnabled: boolean; publicShareSettings: any };
  onClose: () => void;
  onChanged: (share: { publicId: string | null; publicShareEnabled: boolean; publicShareSettings: any }) => void;
}) {
  const [enabled, setEnabled] = useState(initialShare.publicShareEnabled);
  const [publicId, setPublicId] = useState<string | null>(initialShare.publicId);
  const [settings, setSettings] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof initialShare.publicShareSettings === 'string'
        ? JSON.parse(initialShare.publicShareSettings || '{}')
        : initialShare.publicShareSettings || {};
      return { ...SHARE_DEFAULTS, ...raw };
    } catch {
      return { ...SHARE_DEFAULTS };
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const publicUrl = publicId && typeof window !== 'undefined' ? `${window.location.origin}/idea/${publicId}/public` : '';

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.enableIdeaShare(ideaId, settings);
      setEnabled(true);
      setPublicId(res.publicId);
      setSettings(res.publicShareSettings);
      onChanged({ publicId: res.publicId, publicShareEnabled: true, publicShareSettings: res.publicShareSettings });
    } catch (err: any) {
      setError(err.message || 'Could not enable sharing');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    try {
      await api.disableIdeaShare(ideaId);
      setEnabled(false);
      onChanged({ publicId, publicShareEnabled: false, publicShareSettings: settings });
    } catch (err: any) {
      setError(err.message || 'Could not disable sharing');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: string) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    if (!enabled) return; // saved on enable
    try {
      const res = await api.updateIdeaShareSettings(ideaId, next);
      setSettings(res.publicShareSettings);
      onChanged({ publicId, publicShareEnabled: enabled, publicShareSettings: res.publicShareSettings });
    } catch {
      setSettings(settings); // revert on failure
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — link is visible and selectable */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-slate-900">Share Validation</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          A public page anyone can open — investors, co-founders, accelerators. Only the sections you enable are ever
          sent to visitors. Your contact details and your validators&apos; identities are never shown.
        </p>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

        {enabled && publicUrl && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-5">
            <p className="text-xs text-slate-500 mb-1">Public link</p>
            <p className="text-sm text-slate-700 break-all mb-3">{publicUrl}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyLink} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-blue-700">
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button onClick={() => setShowQr(true)} className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:border-slate-300">
                QR Code
              </button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:border-slate-300">
                Preview ↗
              </a>
            </div>
          </div>
        )}

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Visible sections</p>
        <div className="space-y-2 mb-6">
          {SECTION_TOGGLES.map((s) => (
            <label key={s.key} className="flex items-start justify-between gap-3 border border-slate-200 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-300">
              <span>
                <span className="text-sm font-medium text-slate-800 block">{s.label}</span>
                <span className="text-xs text-slate-400">{s.hint}</span>
              </span>
              <input type="checkbox" checked={!!settings[s.key]} onChange={() => toggle(s.key)} className="mt-1 w-4 h-4 accent-blue-600 shrink-0" />
            </label>
          ))}
        </div>

        {!enabled ? (
          <button onClick={enable} disabled={busy}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Creating link…' : 'Create Public Link'}
          </button>
        ) : (
          <button onClick={disable} disabled={busy}
            className="w-full bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-60">
            {busy ? 'Working…' : 'Disable Public Page'}
          </button>
        )}
        {enabled && (
          <p className="text-[11px] text-slate-400 mt-2 text-center">Disabling keeps the link reserved — re-enabling restores the same URL.</p>
        )}
      </div>

      {showQr && publicUrl && (
        <SurveyQrModal url={publicUrl} title={ideaTitle} onClose={() => setShowQr(false)} />
      )}
    </div>
  );
}
