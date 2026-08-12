'use client';

interface ScoreBarProps {
  label: string;
  score: number;
  max?: number;
  color?: string;
}

export default function ScoreBar({ label, score, max = 50, color = 'blue' }: ScoreBarProps) {
  const pct = Math.min((score / max) * 100, 100);
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-blue-400',
    indigo: 'bg-blue-600',
  };

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-900">{score.toFixed(1)} / {max}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${colorMap[color] || 'bg-blue-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
