'use client';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Assumption, AssumptionResult, ASSUMPTION_CATEGORY_LABELS,
  evaluateAssumptions, summarizeAssumptions,
} from '@/lib/assumptionCheck';

const STATUS_META = {
  SUPPORTED: { dot: '🟢', label: 'Supported', chip: 'bg-emerald-50 text-emerald-700' },
  PARTIAL: { dot: '🟡', label: 'Partially Supported', chip: 'bg-amber-50 text-amber-700' },
  NOT_SUPPORTED: { dot: '🔴', label: 'Not Supported', chip: 'bg-red-50 text-red-600' },
  INSUFFICIENT: { dot: '⚪', label: 'Not Enough Evidence', chip: 'bg-slate-100 text-slate-500' },
} as const;

const CATEGORIES = Object.entries(ASSUMPTION_CATEGORY_LABELS);

interface Props {
  // Both optional so the card can render on the public shared report, where
  // there is no owner to save on behalf of. Editing is unreachable without
  // readOnly=false, and every write path below is behind that guard.
  ideaId?: string;
  assumptions: Assumption[];
  aggregated: any;
  surveyAnalytics: any;
  gapKey?: string | null;
  readOnly?: boolean;
  onSaved?: (next: Assumption[]) => void;
}

/**
 * "The founder states what they believe. IdeaValidator tests it against
 * evidence." Statuses are computed live by evaluateAssumptions — nothing here
 * is stored, so the card updates itself as new responses arrive.
 */
export default function AssumptionCheckCard({ ideaId, assumptions, aggregated, surveyAnalytics, gapKey, readOnly, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const results = useMemo(
    () => evaluateAssumptions(assumptions, aggregated, surveyAnalytics, gapKey),
    [assumptions, aggregated, surveyAnalytics, gapKey]
  );
  const summary = summarizeAssumptions(results);

  // ---- empty state: small optional CTA, never a large empty section ----
  if (!assumptions.length) {
    if (readOnly) return null;
    return (
      <>
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-slate-900 text-sm">What are you betting on?</p>
            <p className="text-xs text-slate-500 mt-0.5">Write down what must be true for your idea to work (e.g. &ldquo;people will pay $9/month&rdquo;) — we&apos;ll check each one against your real evidence.</p>
          </div>
          <button onClick={() => setEditing(true)} className="text-sm bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 shrink-0">
            + Add my assumptions
          </button>
        </div>
        {editing && <AssumptionEditor ideaId={ideaId} initial={assumptions} onClose={() => setEditing(false)} onSaved={onSaved} />}
      </>
    );
  }

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">What you&apos;re betting on</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            The things that must be true for your idea to work. We check each one against your real evidence
            and update it automatically as new answers come in.
          </p>
        </div>
        {!readOnly && (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline font-medium shrink-0">Edit</button>
        )}
      </div>

      {/* summary chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {summary.supported > 0 && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META.SUPPORTED.chip}`}>🟢 {summary.supported} Supported</span>}
        {summary.partial > 0 && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META.PARTIAL.chip}`}>🟡 {summary.partial} Partially Supported</span>}
        {summary.notSupported > 0 && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META.NOT_SUPPORTED.chip}`}>🔴 {summary.notSupported} Not Supported</span>}
        {summary.insufficient > 0 && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META.INSUFFICIENT.chip}`}>⚪ {summary.insufficient} Not Enough Evidence</span>}
      </div>

      <div className="space-y-3">
        {results.map((r, i) => (
          <AssumptionRow key={i} r={r} expanded={expanded === i} onToggle={() => setExpanded(expanded === i ? null : i)} />
        ))}
      </div>

      {editing && !readOnly && (
        <AssumptionEditor ideaId={ideaId} initial={assumptions} onClose={() => setEditing(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

function AssumptionRow({ r, expanded, onToggle }: { r: AssumptionResult; expanded: boolean; onToggle: () => void }) {
  const meta = STATUS_META[r.status];
  return (
    <div className={`border rounded-lg p-4 ${r.isBiggestGap ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-slate-900 font-medium">“{r.statement}”</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${meta.chip}`}>{meta.dot} {meta.label}</span>
            {r.category && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{ASSUMPTION_CATEGORY_LABELS[r.category] || r.category}</span>}
          </div>
        </div>
      </div>

      {r.isBiggestGap && (
        <p className="text-xs font-semibold text-rose-700 mt-2">🔥 This assumption is currently your biggest validation gap.</p>
      )}

      {r.headline && <p className="text-sm text-slate-600 mt-2">{r.headline}</p>}

      {(r.target || r.actual) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-slate-500">
          {r.target && <span>Your assumption: <span className="font-semibold text-slate-700">{r.target}</span></span>}
          {r.actual && <span>Actual: <span className="font-semibold text-slate-700">{r.actual}</span></span>}
          {r.delta && <span className="font-medium">{r.delta}</span>}
        </div>
      )}

      <p className="text-xs text-slate-600 mt-2">→ {r.recommendation}</p>

      {r.evidence.length > 0 && (
        <>
          <button onClick={onToggle} className="mt-2 text-xs text-blue-600 hover:underline font-medium">
            {expanded ? 'Hide evidence ▲' : 'View evidence ▼'}
          </button>
          {expanded && (
            <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100">
              {r.evidence.map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-900">{row.value}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">{row.source}</span>
                  </span>
                </div>
              ))}
              <p className="px-3 py-1.5 text-[10px] text-slate-400">All figures come from your validation and survey data — nothing is estimated.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor modal — add/edit/remove assumptions; AI suggestions are listed with
// checkboxes and only added when the founder explicitly accepts them.
// ---------------------------------------------------------------------------
export function AssumptionEditor({ ideaId, initial, onClose, onSaved, draftMode, onDraftChange, draft }: {
  ideaId?: string;
  initial: Assumption[];
  onClose: () => void;
  onSaved?: (next: Assumption[]) => void;
  /** submit-flow mode: no API save — changes flow back to the form state */
  draftMode?: boolean;
  onDraftChange?: (next: Assumption[]) => void;
  /** submit-flow: in-progress idea fields so AI can suggest before the idea exists */
  draft?: { title?: string; problemStatement?: string; solutionDescription?: string; targetCustomer?: string; industryCategory?: string };
}) {
  const [rows, setRows] = useState<Assumption[]>(initial.length ? [...initial] : [{ statement: '', category: undefined }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ statement: string; category: string; checked: boolean }[]>([]);

  const patch = (i: number, p: Partial<Assumption>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const suggest = async () => {
    setSuggesting(true);
    setError('');
    try {
      const res = await api.suggestAssumptions(ideaId ? { ideaId } : { draft });
      setSuggestions(res.suggestions.map((s: any) => ({ ...s, checked: false })));
    } catch (err: any) {
      setError(err.message || 'Could not generate suggestions.');
    } finally {
      setSuggesting(false);
    }
  };

  const addSelected = () => {
    const picked = suggestions.filter((s) => s.checked).map((s) => ({ statement: s.statement, category: s.category }));
    if (!picked.length) return;
    setRows((prev) => [...prev.filter((r) => r.statement.trim()), ...picked]);
    setSuggestions([]);
  };

  const save = async () => {
    const clean = rows.filter((r) => r.statement.trim()).map((r) => ({ statement: r.statement.trim(), category: r.category || undefined }));
    if (draftMode) {
      onDraftChange?.(clean);
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.updateIdeaAssumptions(ideaId!, clean);
      onSaved?.(res.assumptions);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not save assumptions.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-900">Define Your Assumptions</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          List things you believe must be true for your idea to succeed. We&apos;ll test these beliefs against your validation evidence. Entirely optional.
        </p>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 mb-3 text-xs">{error}</div>}

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3">
              <textarea
                value={r.statement}
                onChange={(e) => patch(i, { statement: e.target.value })}
                placeholder={`e.g. "At least 60% of customers will be willing to pay for this."`}
                rows={2}
                maxLength={300}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between gap-2 mt-2">
                <select
                  value={r.category || ''}
                  onChange={(e) => patch(i, { category: e.target.value || undefined })}
                  className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 bg-white"
                >
                  <option value="">Category (optional)</option>
                  {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-slate-400 hover:text-red-500">✕ Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setRows((prev) => [...prev, { statement: '', category: undefined }])}
            className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium hover:border-slate-300">
            + Add Assumption
          </button>
          {(ideaId || draft) && (
            <button onClick={suggest} disabled={suggesting}
              className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-50 disabled:opacity-50">
              {suggesting ? 'Thinking…' : '✨ Suggest with AI'}
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3 border border-blue-200 bg-blue-50/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">AI suggestions — tick the ones you agree with. These are hypotheses to test, not facts.</p>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <label key={i} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={s.checked}
                    onChange={() => setSuggestions((prev) => prev.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                    className="accent-blue-600 mt-0.5" />
                  <span>{s.statement} <span className="text-slate-400">({ASSUMPTION_CATEGORY_LABELS[s.category] || s.category})</span></span>
                </label>
              ))}
            </div>
            <button onClick={addSelected} className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700">
              Add selected
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
