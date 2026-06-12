'use client';

interface ScoreBarProps {
  label: string;
  score: number;
  max?: number;
  color?: string;
}

export default function ScoreBar({ label, score, max = 50, color = 'indigo' }: ScoreBarProps) {
  const pct = Math.min((score / max) * 100, 100);
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
  };

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold">{score.toFixed(1)} / {max}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${colorMap[color] || 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
