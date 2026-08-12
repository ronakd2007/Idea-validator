'use client';
import { useState } from 'react';
import { QuestionDraft } from '@/lib/surveyTypes';
import { toEmbedUrl, isDirectVideoUrl } from '@/lib/media';

function MediaBlock({ url, type }: { url: string; type: 'IMAGE' | 'VIDEO' }) {
  if (type === 'IMAGE') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className="w-full max-w-md rounded-lg mb-3 border border-slate-200" />;
  }
  const embed = toEmbedUrl(url);
  if (embed) {
    return (
      <div className="w-full max-w-md aspect-video mb-3 rounded-lg overflow-hidden border border-slate-200">
        <iframe src={embed} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Video" />
      </div>
    );
  }
  if (isDirectVideoUrl(url)) {
    return <video src={url} controls preload="metadata" className="w-full max-w-md rounded-lg mb-3 border border-slate-200" />;
  }
  return null;
}

interface Props {
  question: QuestionDraft;
  index: number;
  // Controlled mode (used by the public respondent form). When omitted, the
  // component falls back to its own local state — the original Phase 1
  // founder-preview behavior, unchanged.
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
}

// Respondent-facing render of a single question. Doubles as the founder's
// self-preview (uncontrolled, local-only state) and the real public
// submission form (controlled via value/onChange) — same rendering code
// either way, so the public form can never drift from the builder's data.
export default function QuestionPreview({ question, index, value, onChange, error }: Props) {
  const q = question;
  const controlled = onChange !== undefined;

  const [localText, setLocalText] = useState('');
  const [localChoice, setLocalChoice] = useState<string>('');
  const [localChecked, setLocalChecked] = useState<string[]>([]);
  const [localNumber, setLocalNumber] = useState<number | null>(null);

  const text = controlled ? (value ?? '') : localText;
  const setText = (v: string) => {
    if (controlled) onChange!(v);
    else setLocalText(v);
  };
  const choice = controlled ? (value ?? '') : localChoice;
  const setChoice = (v: string) => {
    if (controlled) onChange!(v);
    else setLocalChoice(v);
  };
  const checkedList: string[] = controlled ? (Array.isArray(value) ? value : []) : localChecked;
  const toggleChecked = (id: string, isChecked: boolean) => {
    const next = isChecked ? [...checkedList, id] : checkedList.filter((v) => v !== id);
    if (controlled) onChange!(next);
    else setLocalChecked(next);
  };
  const numberVal: number | null = controlled ? (typeof value === 'number' ? value : null) : localNumber;
  const setNumberVal = (v: number) => {
    if (controlled) onChange!(v);
    else setLocalNumber(v);
  };

  const min = q.settings.min ?? 1;
  const max = q.settings.max ?? (q.type === 'RATING' ? 5 : 10);

  return (
    <div className={`bg-white border rounded-xl p-6 shadow-sm ${error ? 'border-red-300' : 'border-slate-200'}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-400">{index + 1}.</span>
        <p className="text-base font-medium text-slate-900">
          {q.questionText || <span className="text-slate-400">Untitled question</span>}
          {q.required && <span className="text-red-500 ml-1">*</span>}
        </p>
      </div>
      {q.description && <p className="text-sm text-slate-500 mb-4 ml-5">{q.description}</p>}

      <div className="ml-5 mt-3">
        {q.mediaUrl && q.mediaType && <MediaBlock url={q.mediaUrl} type={q.mediaType} />}

        {q.type === 'IMAGE_CHOICE' && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChoice(opt.id)}
                className={`text-left rounded-lg border-2 overflow-hidden transition-colors ${choice === opt.id ? 'border-blue-600' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="aspect-video bg-slate-50 flex items-center justify-center">
                  {opt.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.imageUrl} alt={opt.label} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-300">No image</span>
                  )}
                </div>
                <p className={`text-sm px-2 py-1.5 ${choice === opt.id ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>{opt.label}</p>
              </button>
            ))}
          </div>
        )}

        {q.type === 'SHORT_ANSWER' && (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer"
            className="w-full max-w-md border-0 border-b border-slate-200 focus:border-blue-500 focus:outline-none py-1.5 text-sm text-slate-700"
          />
        )}

        {q.type === 'PARAGRAPH' && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer"
            rows={3}
            className="w-full max-w-md border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none p-2.5 text-sm text-slate-700"
          />
        )}

        {q.type === 'MULTIPLE_CHOICE' && (
          <div className="space-y-2.5">
            {q.options.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer py-0.5">
                <input type="radio" name={`q-${q.id}`} checked={choice === opt.id} onChange={() => setChoice(opt.id)} className="accent-blue-600 w-5 h-5" />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {q.type === 'CHECKBOXES' && (
          <div className="space-y-2.5">
            {q.options.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={checkedList.includes(opt.id)}
                  onChange={(e) => toggleChecked(opt.id, e.target.checked)}
                  className="accent-blue-600 w-5 h-5"
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {q.type === 'DROPDOWN' && (
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="border border-slate-200 rounded-lg text-sm px-3 py-2.5 max-w-xs w-full">
            <option value="" disabled>Choose</option>
            {q.options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        )}

        {q.type === 'YES_NO' && (
          <div className="space-y-2.5">
            {['Yes', 'No'].map((label) => (
              <label key={label} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer py-0.5">
                <input type="radio" name={`q-${q.id}`} checked={choice === label} onChange={() => setChoice(label)} className="accent-blue-600 w-5 h-5" />
                {label}
              </label>
            ))}
          </div>
        )}

        {q.type === 'RATING' && (
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumberVal(n)}
                className={`w-10 h-10 rounded-full text-sm font-semibold border transition-colors ${
                  numberVal === n ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {q.type === 'LINEAR_SCALE' && (
          <div className="max-w-md">
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumberVal(n)}
                  className={`w-9 h-9 rounded-full text-xs font-semibold border transition-colors ${
                    numberVal === n ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {(q.settings.minLabel || q.settings.maxLabel) && (
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{q.settings.minLabel}</span>
                <span>{q.settings.maxLabel}</span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
