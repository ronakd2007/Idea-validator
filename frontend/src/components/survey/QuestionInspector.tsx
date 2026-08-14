'use client';
import { QUESTION_TYPE_LABEL, QuestionDraft } from '@/lib/surveyTypes';

// Right-hand pane of the 3-pane builder: settings for the currently selected
// question. Shown lg+ only — below that the same controls render inline on the
// question card (QuestionEditor hides them at lg when hasInspector is set), so
// exactly one surface is visible at a time and both patch the same state.

const NUMERIC_TYPES = ['RATING', 'LINEAR_SCALE'];

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

export default function QuestionInspector({ question, index, total, allQuestions, onChange, onMoveUp, onMoveDown, onDuplicate, onDelete }: Props) {
  const q = question;
  const pairableQuestions = allQuestions.filter((other) => other.id !== q.id && NUMERIC_TYPES.includes(other.type));

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Question {index + 1}</p>
        <p className="text-sm font-medium text-slate-800 mt-0.5">{QUESTION_TYPE_LABEL[q.type]}</p>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Required */}
        <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer select-none">
          <span className="font-medium">Required</span>
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

        {/* Analytics options */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <p className="text-[11px] text-slate-400">Analytics options — respondents never see these.</p>

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
                checked={!!q.abGroupKey || q.abGroupKey === ''}
                onChange={(e) => onChange({ abGroupKey: e.target.checked ? q.abGroupKey || '' : null, abVariant: e.target.checked ? q.abVariant || 'A' : null })}
                className="accent-blue-600 w-4 h-4"
              />
              Part of an A/B test
            </label>
            {q.abGroupKey !== null && q.abGroupKey !== undefined && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={q.abGroupKey}
                  onChange={(e) => onChange({ abGroupKey: e.target.value })}
                  placeholder="Group name (e.g. pricing-test)"
                  className="w-full border border-slate-200 rounded-md text-sm px-2 py-1.5"
                />
                <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1 w-fit">
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
                {q.abGroupKey && (
                  <p className="text-[11px] text-slate-400">Create another question with the same group name and the other variant — respondents will randomly see one of the two.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Arrange */}
        <div className="pt-4 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onMoveUp} disabled={index === 0}
              className="text-sm border border-slate-200 text-slate-600 rounded-lg py-1.5 hover:border-slate-300 disabled:opacity-40 transition">
              ↑ Move up
            </button>
            <button type="button" onClick={onMoveDown} disabled={index === total - 1}
              className="text-sm border border-slate-200 text-slate-600 rounded-lg py-1.5 hover:border-slate-300 disabled:opacity-40 transition">
              ↓ Move down
            </button>
            <button type="button" onClick={onDuplicate}
              className="text-sm border border-slate-200 text-slate-600 rounded-lg py-1.5 hover:border-slate-300 transition">
              ⧉ Duplicate
            </button>
            <button type="button" onClick={onDelete}
              className="text-sm border border-red-200 text-red-600 rounded-lg py-1.5 hover:bg-red-50 transition">
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
