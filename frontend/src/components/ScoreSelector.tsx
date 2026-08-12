'use client';

interface ScoreSelectorProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel?: string;
  highLabel?: string;
}

/**
 * Premium 1-10 button selector — replaces the old <input type="range">
 * sliders across the app. Same onChange(number) contract as the sliders
 * it replaces, so callers don't need to change their state shape.
 */
export default function ScoreSelector({
  label,
  description,
  value,
  onChange,
  lowLabel = 'Very Weak',
  highLabel = 'Excellent',
}: ScoreSelectorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm font-semibold text-blue-600 tabular-nums">{value} / 10</span>
      </div>
      {description && <p className="text-xs text-slate-500 mb-3">{description}</p>}

      <div className="grid grid-cols-10 gap-1.5" role="radiogroup" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-9 rounded-md text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              value === n
                ? 'bg-blue-600 text-white scale-105 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-1.5 text-[11px] text-slate-400">
        <span>{lowLabel}</span>
        <span>Average</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
