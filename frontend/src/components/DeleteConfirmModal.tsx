'use client';
import { useEffect, useState } from 'react';

export interface DeleteImpactLine {
  label: string;
  count: number;
  /** true when losing this is irreversible and matters (responses, validations) */
  severe?: boolean;
}

/**
 * Confirmation dialog for deletions that destroy collected data.
 *
 * The friction scales with what is actually at stake: an empty draft needs one
 * click, but anything holding responses or expert validations requires the
 * owner to type the exact title. That mirrors the server-side guard rather
 * than replacing it — the API refuses the same deletions on its own.
 */
export default function DeleteConfirmModal({
  title,
  itemName,
  impact,
  requiresTitleConfirmation,
  busy,
  error,
  onCancel,
  onConfirm,
  extraWarning,
}: {
  title: string;
  itemName: string;
  impact: DeleteImpactLine[];
  requiresTitleConfirmation: boolean;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (confirmTitle: string) => void;
  extraWarning?: string;
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  const matches = typed.trim() === itemName.trim();
  const canDelete = !busy && (!requiresTitleConfirmation || matches);
  const atStake = impact.filter((i) => i.count > 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4" role="dialog" aria-modal="true" onClick={() => !busy && onCancel()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600 mb-4 break-words">
          <span className="font-medium text-slate-900">{itemName}</span>
        </p>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm mb-4">{error}</div>}

        {atStake.length > 0 ? (
          <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 mb-4">
            <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">This permanently deletes</p>
            <ul className="space-y-1">
              {atStake.map((i) => (
                <li key={i.label} className="text-sm text-red-800 flex justify-between gap-3">
                  <span>{i.label}</span>
                  <span className="font-bold tabular-nums">{i.count}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-red-700 mt-2.5">This cannot be undone.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-4">Nothing has been collected yet, so nothing is lost.</p>
        )}

        {extraWarning && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{extraWarning}</p>}

        {requiresTitleConfirmation && (
          <div className="mb-4">
            <label className="block text-xs text-slate-600 mb-1.5">
              Type the exact name to confirm:
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={itemName}
              autoFocus
              disabled={busy}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy}
            className="text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(typed.trim())}
            disabled={!canDelete}
            className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
