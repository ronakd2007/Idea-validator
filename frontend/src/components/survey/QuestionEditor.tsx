'use client';
import { useState } from 'react';
import { QUESTION_TYPE_LABEL, QuestionDraft, newId } from '@/lib/surveyTypes';

interface Props {
  question: QuestionDraft;
  index: number;
  total: number;
  allQuestions: QuestionDraft[];
  onChange: (patch: Partial<QuestionDraft>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const CHOICE_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'];
const NUMERIC_TYPES = ['RATING', 'LINEAR_SCALE'];

function OptionIcon({ type }: { type: string }) {
  if (type === 'CHECKBOXES') return <span className="w-4 h-4 rounded border border-slate-300 shrink-0" />;
  if (type === 'DROPDOWN') return <span className="text-xs text-slate-400 w-4 shrink-0">{'–'}</span>;
  return <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />;
}

export default function QuestionEditor({ question, index, total, allQuestions, onChange, onMoveUp, onMoveDown, onDuplicate, onDelete }: Props) {
  const q = question;
  const [showAdvanced, setShowAdvanced] = useState(false);

  const pairableQuestions = allQuestions.filter((other) => other.id !== q.id && NUMERIC_TYPES.includes(other.type));

  const updateOption = (id: string, patch: Partial<{ label: string; imageUrl: string }>) => {
    onChange({ options: q.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  };
  const addOption = () => {
    const n = q.options.length + 1;
    onChange({ options: [...q.options, q.type === 'IMAGE_CHOICE' ? { id: newId(), label: `Option ${n}`, imageUrl: '' } : { id: newId(), label: `Option ${n}` }] });
  };
  const removeOption = (id: string) => {
    onChange({ options: q.options.filter((o) => o.id !== id) });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Question {index + 1}</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{QUESTION_TYPE_LABEL[q.type]}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <button type="button" onClick={onMoveUp} disabled={index === 0} title="Move up"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent">
            &uarr;
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} title="Move down"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent">
            &darr;
          </button>
          <button type="button" onClick={onDuplicate} title="Duplicate"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 hover:text-slate-700 text-sm">
            &#10697;
          </button>
          <button type="button" onClick={onDelete} title="Delete"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 hover:text-red-600 text-sm">
            &#128465;
          </button>
        </div>
      </div>

      <input
        type="text"
        value={q.questionText}
        onChange={(e) => onChange({ questionText: e.target.value })}
        placeholder="Question text"
        className="w-full text-base font-medium border-0 border-b border-slate-200 focus:border-blue-500 focus:outline-none pb-2 mb-3 text-slate-900 placeholder:text-slate-400"
      />

      <input
        type="text"
        value={q.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description or help text (optional)"
        className="w-full text-sm border-0 focus:outline-none mb-3 text-slate-600 placeholder:text-slate-400"
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
          {([null, 'IMAGE', 'VIDEO'] as const).map((t) => (
            <button
              key={t ?? 'none'}
              type="button"
              onClick={() => onChange({ mediaType: t, mediaUrl: t ? q.mediaUrl : null })}
              className={`px-2.5 py-1 rounded text-xs font-medium ${q.mediaType === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              {t === null ? 'No media' : t === 'IMAGE' ? 'Image' : 'Video'}
            </button>
          ))}
        </div>
        {q.mediaType && (
          <input
            type="text"
            value={q.mediaUrl || ''}
            onChange={(e) => onChange({ mediaUrl: e.target.value })}
            placeholder={q.mediaType === 'IMAGE' ? 'Image URL' : 'Video URL (YouTube, Loom, Vimeo)'}
            className="flex-1 text-sm border border-slate-200 rounded-md px-2 py-1.5"
          />
        )}
      </div>

      {CHOICE_TYPES.includes(q.type) && (
        <div className="space-y-2 mb-4">
          {q.options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <OptionIcon type={q.type} />
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                className="flex-1 text-sm border-0 border-b border-slate-100 focus:border-blue-500 focus:outline-none py-1 text-slate-700"
              />
              {q.options.length > 1 && (
                <button type="button" onClick={() => removeOption(opt.id)} className="text-slate-300 hover:text-red-500 text-sm px-1">&times;</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOption} className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">+ Add option</button>
        </div>
      )}

      {q.type === 'IMAGE_CHOICE' && (
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {q.options.map((opt) => (
            <div key={opt.id} className="border border-slate-200 rounded-lg p-3">
              <div className="aspect-video bg-slate-50 rounded-md mb-2 overflow-hidden flex items-center justify-center">
                {opt.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-300">No image</span>
                )}
              </div>
              <input
                type="text"
                value={opt.imageUrl || ''}
                onChange={(e) => updateOption(opt.id, { imageUrl: e.target.value })}
                placeholder="Image URL"
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 mb-1.5"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                  placeholder="Label"
                  className="flex-1 text-sm border-0 border-b border-slate-100 focus:border-blue-500 focus:outline-none py-1 text-slate-700"
                />
                {q.options.length > 1 && (
                  <button type="button" onClick={() => removeOption(opt.id)} className="text-slate-300 hover:text-red-500 text-sm px-1">&times;</button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={addOption} className="text-sm text-blue-600 hover:text-blue-700 font-medium self-start sm:col-span-2">+ Add image option</button>
        </div>
      )}

      {q.type === 'YES_NO' && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400"><span className="w-4 h-4 rounded-full border border-slate-200 shrink-0" /> Yes</div>
          <div className="flex items-center gap-2 text-sm text-slate-400"><span className="w-4 h-4 rounded-full border border-slate-200 shrink-0" /> No</div>
          <p className="text-xs text-slate-400">Yes / No answers are added automatically.</p>
        </div>
      )}

      {q.type === 'RATING' && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-slate-600">Scale (max)</label>
          <select
            value={q.settings.max ?? 5}
            onChange={(e) => onChange({ settings: { ...q.settings, max: Number(e.target.value) } })}
            className="border border-slate-200 rounded-md text-sm px-2 py-1"
          >
            {[3, 4, 5, 7, 10].map((n) => (
              <option key={n} value={n}>1 – {n}</option>
            ))}
          </select>
        </div>
      )}

      {q.type === 'LINEAR_SCALE' && (
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-slate-600 w-10">Min</label>
            <select
              value={q.settings.min ?? 1}
              onChange={(e) => onChange({ settings: { ...q.settings, min: Number(e.target.value) } })}
              className="border border-slate-200 rounded-md text-sm px-2 py-1"
            >
              {[0, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input
              type="text"
              value={q.settings.minLabel ?? ''}
              onChange={(e) => onChange({ settings: { ...q.settings, minLabel: e.target.value } })}
              placeholder="Label for minimum (optional)"
              className="flex-1 min-w-[140px] text-sm border-0 border-b border-slate-100 focus:border-blue-500 focus:outline-none py-1 text-slate-700"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-slate-600 w-10">Max</label>
            <select
              value={q.settings.max ?? 10}
              onChange={(e) => onChange({ settings: { ...q.settings, max: Number(e.target.value) } })}
              className="border border-slate-200 rounded-md text-sm px-2 py-1"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input
              type="text"
              value={q.settings.maxLabel ?? ''}
              onChange={(e) => onChange({ settings: { ...q.settings, maxLabel: e.target.value } })}
              placeholder="Label for maximum (optional)"
              className="flex-1 min-w-[140px] text-sm border-0 border-b border-slate-100 focus:border-blue-500 focus:outline-none py-1 text-slate-700"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <span>Required</span>
          <button
            type="button"
            role="switch"
            aria-checked={q.required}
            onClick={() => onChange({ required: !q.required })}
            className={`relative w-9 h-5 rounded-full transition-colors ${q.required ? 'bg-blue-600' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${q.required ? 'translate-x-4' : ''}`} />
          </button>
        </label>
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600">
          {showAdvanced ? 'Hide analytics options' : 'Analytics options'}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-4">
          <p className="text-[11px] text-slate-400">These settings only affect analytics — respondents never see them.</p>

          {NUMERIC_TYPES.includes(q.type) && (
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none mb-2">
                <input
                  type="checkbox"
                  checked={!!q.isControlQuestion}
                  onChange={(e) => onChange({ isControlQuestion: e.target.checked, consistencyPairQuestionId: e.target.checked ? q.consistencyPairQuestionId : null })}
                  className="accent-blue-600 w-4 h-4"
                />
                Consistency check
              </label>
              {q.isControlQuestion && (
                <select
                  value={q.consistencyPairQuestionId || ''}
                  onChange={(e) => onChange({ consistencyPairQuestionId: e.target.value || null })}
                  className="w-full border border-slate-200 rounded-md text-sm px-2 py-1.5"
                >
                  <option value="">Pairs with...</option>
                  {pairableQuestions.map((other) => (
                    <option key={other.id} value={other.id}>{other.questionText || `Question ${allQuestions.indexOf(other) + 1}`}</option>
                  ))}
                </select>
              )}
              {q.isControlQuestion && pairableQuestions.length === 0 && (
                <p className="text-[11px] text-amber-600">Add another Rating or Linear Scale question to pair with.</p>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none mb-2">
              <input
                type="checkbox"
                checked={!!q.abGroupKey}
                onChange={(e) => onChange({ abGroupKey: e.target.checked ? q.abGroupKey || '' : null, abVariant: e.target.checked ? q.abVariant || 'A' : null })}
                className="accent-blue-600 w-4 h-4"
              />
              Part of an A/B test
            </label>
            {q.abGroupKey !== null && q.abGroupKey !== undefined && (
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={q.abGroupKey}
                  onChange={(e) => onChange({ abGroupKey: e.target.value })}
                  placeholder="Group name (e.g. pricing-test)"
                  className="flex-1 min-w-[160px] border border-slate-200 rounded-md text-sm px-2 py-1.5"
                />
                <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
                  {(['A', 'B'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onChange({ abVariant: v })}
                      className={`px-3 py-1 rounded text-sm font-medium ${q.abVariant === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                      Variant {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {q.abGroupKey && (
              <p className="text-[11px] text-slate-400 mt-1.5">Create another question with the same group name and the other variant — respondents will randomly see one of the two.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
