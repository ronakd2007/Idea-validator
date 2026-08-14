// The one page-title pattern: consistent type scale, and actions that sit
// beside the title on wide screens but wrap below it on phones instead of
// crushing the title column.
export default function PageHeader({
  title,
  subtitle,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4 mb-8 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1 text-sm sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}
