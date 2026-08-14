import Link from 'next/link';

// Compact metric tile for overview rows. Deliberately quiet: label, value,
// optional context line — the value carries the hierarchy, not decoration.
export default function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </>
  );
  const cls = 'block bg-white rounded-xl border border-slate-200 shadow-sm p-5';
  if (href) {
    return (
      <Link href={href} className={`${cls} hover:border-blue-300 hover:shadow transition`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
