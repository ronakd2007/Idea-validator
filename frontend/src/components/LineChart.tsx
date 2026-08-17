'use client';

interface LinePoint {
  label: string;
  value: number;
}

// Trend line for change-over-time data (responses per day/hour). A line, not
// bars: the story is the shape of the trend, not a comparison of individual
// buckets. SVG, dependency-free, with a soft area fill and sparse x labels.
export default function LineChart({ data, height = 150, color = '#2563eb' }: { data: LinePoint[]; height?: number; color?: string }) {
  if (!data.length) return <p className="text-sm text-slate-400 text-center py-8">No data in this range.</p>;

  const W = 600; // viewBox units — the SVG scales to its container
  const H = 150;
  const PAD_X = 6;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 4;

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (W - PAD_X * 2) / (data.length - 1) : 0;
  const x = (i: number) => (data.length > 1 ? PAD_X + i * stepX : W / 2);
  const y = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM);

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${H - PAD_BOTTOM} L${x(0).toFixed(1)},${H - PAD_BOTTOM} Z`;

  // Show at most ~6 x labels so 30/90-day ranges stay readable.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none" role="img" aria-label="Responses over time">
        <path d={areaPath} fill={color} opacity={0.08} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) =>
          d.value > 0 ? (
            <circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill={color} stroke="#fff" strokeWidth={1.5}>
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          ) : null
        )}
      </svg>
      <div className="flex justify-between mt-1">
        {data.map((d, i) => (
          <span key={i} className="text-[9px] text-slate-400 flex-1 text-center truncate">
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
