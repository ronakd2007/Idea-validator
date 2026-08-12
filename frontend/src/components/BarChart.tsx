'use client';

interface BarDatum {
  label: string;
  value: number;
}

export default function BarChart({ data, height = 140, color = '#2563eb' }: { data: BarDatum[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.label}: ${d.value}`}>
          <div
            className="w-full rounded-t transition-all"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, background: color }}
          />
          <span className="text-[9px] text-slate-400 mt-1.5 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
