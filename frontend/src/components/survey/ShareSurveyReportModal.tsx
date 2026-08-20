'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import SurveyQrModal from '@/components/survey/SurveyQrModal';

const SECTION_TOGGLES: { key: string; label: string; hint: string }[] = [
  { key: 'showSummary', label: 'Headline numbers', hint: 'Response count, completion rate, average time' },
  { key: 'showCharts', label: 'Charts & insights', hint: 'Per-question breakdown, trend, drop-off, key insights' },
  { key: 'showResponses', label: 'Individual responses', hint: 'Answer-by-answer browser, including open-text answers' },
  { key: 'showQuality', label: 'Response quality', hint: 'Quality scoring and consistency flags' },
];

const DEFAULTS = { showSummary: true, showCharts: true, showResponses: true, showQuality: true };

/**
 * Founder-facing control panel for a survey's public results link.
 * Every toggle maps 1:1 to the server-side whitelist — a section switched off
 * is removed from the API payload, not just hidden in the page.
 */
export default function ShareSurveyReportModal({
  surveyId,
  surveyTitle,
  initialShare,
  onClose,
  onChanged,
}: {
  surveyId: string;
  surveyTitle: string;
  initialShare: { shareId: string | null; shareEnabled: boolean; shareSettings: any } | null;
  onClose: () => void;
  onChanged: (share: { shareId: string | null; shareEnabled: boolean; shareSettings: any }) => void;
}) {
  const [enabled, setEnabled] = useState(!!initialShare?.shareEnabled);
  const [shareId, setShareId] = useState<string | null>(initialShare?.shareId ?? null);
  const [settings, setSettings] = useState<Record<string, boolean>>({ ...DEFAULTS, ...(initialShare?.shareSettings || {}) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const publicUrl = shareId && typeof window !== 'undefined' ? `${window.location.origin}/survey-report/${shareId}` : '';

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.enableSurveyShare(surveyId, settings);
      setEnabled(true);
      setShareId(res.shareId);
      setSettings({ ...DEFAULTS, ...res.shareSettings });
      onChanged(res);
    } catch (err: any) {
      setError(err.message || 'Could not create the link');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    try {
      await api.disableSurveyShare(surveyId);
      setEnabled(false);
      onChanged({ shareId, shareEnabled: false, shareSettings: settings });
    } catch (err: any) {
      setError(err.message || 'Could not turn off sharing');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: string) => {
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    if (!enabled) return; // saved on enable
    try {
      const res = await api.updateSurveyShareSettings(surveyId, next);
      setSettings({ ...DEFAULTS, ...res.shareSettings });
      onChanged(res);
    } catch {
      setSettings(previous); // revert on failure
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
          <h3 className="font-semibold text-slate-900">Share Results</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          A live results page anyone can open — no account needed. It always reflects the latest responses.
          Only the sections you enable are ever sent to visitors.
        </p>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

        {enabled && publicUrl && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-5">
            <p className="text-xs text-slate-500 mb-1">Public results link</p>
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
        <div className="space-y-2 mb-4">
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

        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-5">
          Respondent email addresses are never shown on the public page, even when &ldquo;Individual responses&rdquo; is on —
          they belong to the people who answered. Use Export Responses to get them privately.
        </p>

        {!enabled ? (
          <button onClick={enable} disabled={busy}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Creating link…' : 'Create Public Link'}
          </button>
        ) : (
          <button onClick={disable} disabled={busy}
            className="w-full bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-60">
            {busy ? 'Working…' : 'Stop Sharing'}
          </button>
        )}
        {enabled && (
          <p className="text-[11px] text-slate-400 mt-2 text-center">Stopping keeps the link reserved — re-enabling restores the same URL.</p>
        )}
      </div>

      {showQr && publicUrl && (
        <SurveyQrModal url={publicUrl} title={surveyTitle} onClose={() => setShowQr(false)} />
      )}
    </div>
  );
}
