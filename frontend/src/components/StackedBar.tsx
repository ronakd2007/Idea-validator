'use client';

export interface StackedSegment {
  label: string;
  count: number;
  color: string; // background color for the segment
  icon?: string; // status segments carry an icon so color is never the only signal
}

// One 100% stacked horizontal bar — the parts-of-a-whole form. Used for
// Yes/No splits, completion (completed vs abandoned) and response quality.
// Segments are separated by a 2px surface gap, and every segment is named in
// the legend chips below with icon + count, never identified by color alone.
export default function StackedBar({ segments, showLegend = true }: { segments: StackedSegment[]; showLegend?: boolean }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <p className="text-sm text-slate-400">No answers yet.</p>;

  const visible = segments.filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex w-full h-4 rounded-full overflow-hidden bg-slate-100" style={{ gap: 2 }}>
        {visible.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.count} (${((s.count / total) * 100).toFixed(0)}%)`}
            className="h-full first:rounded-l-full last:rounded-r-full transition-all"
            style={{ width: `${(s.count / total) * 100}%`, background: s.color, minWidth: 6 }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
          {segments.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              {s.icon && <span aria-hidden>{s.icon}</span>}
              {s.label}
              <span className="text-slate-400 tabular-nums">
                {s.count} · {((s.count / total) * 100).toFixed(0)}%
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
