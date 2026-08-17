'use client';
import { useState } from 'react';

export interface HBarDatum {
  label: string;
  count: number;
  pct: number; // 0–100, already computed by the caller against the right base
  imageUrl?: string | null;
  highlight?: boolean; // e.g. the biggest drop-off step
}

// Horizontal bar chart for categorical answers. Horizontal on purpose: option
// labels are sentences, and vertical bars would force rotated, unreadable text.
// Values are written on the bars — nobody should have to hover to read a result.
export default function HBarChart({
  data,
  sorted = true,
  maxBars = 8,
  color = '#2563eb',
  highlightColor = '#e11d48',
}: {
  data: HBarDatum[];
  sorted?: boolean; // false for ordered data like a drop-off funnel
  maxBars?: number;
  color?: string;
  highlightColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const rows = sorted ? [...data].sort((a, b) => b.count - a.count) : data;

  // More than maxBars answers nothing — fold the tail into "Other" until asked.
  const overflow = rows.length > maxBars && !expanded;
  const shown = overflow ? rows.slice(0, maxBars - 1) : rows;
  const folded = overflow ? rows.slice(maxBars - 1) : [];
  const foldedCount = folded.reduce((s, d) => s + d.count, 0);

  const maxPct = Math.max(1, ...rows.map((d) => d.pct));

  return (
    <div className="space-y-2.5">
      {shown.map((d, i) => (
        <div key={`${d.label}-${i}`} title={`${d.label}: ${d.count} (${d.pct.toFixed(0)}%)`}>
          <div className="flex justify-between items-center text-sm mb-1 gap-2">
            <span className="text-slate-700 flex items-center gap-2 min-w-0">
              {d.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" loading="lazy" className="w-8 h-6 object-cover rounded border border-slate-200 shrink-0" />
              )}
              <span className="truncate">{d.label}</span>
            </span>
            <span className="text-slate-500 shrink-0 tabular-nums text-xs">
              {d.count} · {d.pct.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min((d.pct / maxPct) * 100, 100)}%`, minWidth: d.count > 0 ? 4 : 0, background: d.highlight ? highlightColor : color }}
            />
          </div>
        </div>
      ))}

      {overflow && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          + Show {folded.length} more option{folded.length !== 1 ? 's' : ''} ({foldedCount} answer{foldedCount !== 1 ? 's' : ''})
        </button>
      )}
      {expanded && data.length > maxBars && (
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Show fewer
        </button>
      )}
    </div>
  );
}
