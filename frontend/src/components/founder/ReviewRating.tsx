'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/feedback';

const OPTIONS = [
  { value: 3, label: 'Very helpful', emoji: '👍' },
  { value: 2, label: 'Somewhat', emoji: '🤝' },
  { value: 1, label: 'Not helpful', emoji: '👎' },
];

// The founder's rating of one expert review. This is the quality gate behind
// the validator incentive model — reviews rated unhelpful shouldn't earn — and
// it will later feed a validator's public reputation. Deliberately low-key:
// three small buttons, not a demanded star rating, so skipping it is fine.
export default function ReviewRating({
  validationId,
  initial,
  readOnly,
}: {
  validationId: string;
  initial: number | null;
  readOnly?: boolean;
}) {
  const [rating, setRating] = useState<number | null>(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const rate = async (value: number) => {
    if (readOnly || saving) return;
    const previous = rating;
    setRating(value); // optimistic — this is a low-stakes, instantly reversible action
    setSaving(true);
    try {
      await api.rateValidation(validationId, value);
    } catch (err: any) {
      setRating(previous);
      toast.error(err.message || 'Could not save your rating.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
      <span className="text-xs text-slate-500">
        {rating ? 'You rated this review:' : 'Was this review helpful?'}
      </span>
      <div className="flex items-center gap-1.5">
        {OPTIONS.map((o) => {
          const active = rating === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => rate(o.value)}
              disabled={readOnly || saving}
              title={readOnly ? 'Disabled while viewing as another user.' : o.label}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <span aria-hidden className="mr-1">{o.emoji}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      {rating != null && (
        <span className="text-[11px] text-slate-400">
          Helps us send you better reviewers next time.
        </span>
      )}
    </div>
  );
}
