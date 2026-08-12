import { View, Text, Svg, Polygon, Line, Circle } from '@react-pdf/renderer';
import { colors } from './reportStyles';

// Same polygon math as frontend/src/components/RadarChart.tsx (the radar chart
// already shown on the live dashboard) — ported to react-pdf's SVG primitives.
// Labels render as an external legend rather than inline SVG text: this
// version of @react-pdf/renderer's SVG <Text> doesn't expose a typed
// `fontSize` prop, and a legend reads just as clearly in a static document.
export default function RadarChartPdf({ data, size = 220, showLegend = true }: { data: { label: string; value: number }[]; size?: number; showLegend?: boolean }) {
  const n = data.length;
  if (n < 3) return null;

  const center = size / 2;
  const radius = size / 2 - 20;
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
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((r) => {
          const pts = data.map((_, i) => point(i, r)).map((p) => `${p.x},${p.y}`).join(' ');
          return <Polygon key={r} points={pts} fill="none" stroke={colors.line} strokeWidth={1} />;
        })}
        {data.map((_, i) => {
          const p = point(i, 1);
          return <Line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke={colors.line} strokeWidth={1} />;
        })}
        <Polygon points={polygonPoints} fill={colors.blueSoft} stroke={colors.blue} strokeWidth={2} />
        {data.map((d, i) => {
          const p = point(i, Math.max(0, Math.min(100, d.value)) / 100);
          return <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colors.blue} />;
        })}
      </Svg>
      {showLegend && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10, maxWidth: size }}>
          {data.map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.blue }} />
              <Text style={{ fontSize: 6.5, color: colors.inkSoft }}>{d.label} {d.value.toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
