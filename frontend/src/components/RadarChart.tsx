'use client';

interface RadarDatum {
  label: string;
  value: number; // 0-100
}

export default function RadarChart({ data, size = 280 }: { data: RadarDatum[]; size?: number }) {
  const n = data.length;
  if (n < 3) return null;

  const center = size / 2;
  const radius = size / 2 - 44;
  const rings = [0.25, 0.5, 0.75, 1];

  const point = (i: number, frac: number) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / n);
    return { x: center + radius * frac * Math.cos(angle), y: center + radius * frac * Math.sin(angle) };
  };

  const polygonPoints = data
    .map((d, i) => point(i, Math.max(0, Math.min(100, d.value)) / 100))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto overflow-visible">
      {rings.map((r) => {
        const pts = data
          .map((_, i) => point(i, r))
          .map((p) => `${p.x},${p.y}`)
          .join(' ');
        return <polygon key={r} points={pts} fill="none" stroke="#e2e8f0" strokeWidth={1} />;
      })}
      {data.map((_, i) => {
        const p = point(i, 1);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      <polygon points={polygonPoints} fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth={2} />
      {data.map((d, i) => {
        const p = point(i, Math.max(0, Math.min(100, d.value)) / 100);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2563eb" />;
      })}
      {data.map((d, i) => {
        const p = point(i, 1.2);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#475569">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
