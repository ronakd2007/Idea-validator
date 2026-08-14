// Empty states explain three things: what's missing, why it matters, and the
// one action to take — never a bare "No data."
export default function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? 'py-10' : 'py-20'} px-6`}>
      {icon && <div className={`${compact ? 'text-3xl mb-3' : 'text-5xl mb-4'}`}>{icon}</div>}
      <h2 className={`font-semibold text-slate-800 mb-2 ${compact ? 'text-base' : 'text-xl'}`}>{title}</h2>
      <p className={`text-slate-500 mx-auto max-w-md ${compact ? 'text-sm mb-4' : 'mb-6'}`}>{body}</p>
      {action}
    </div>
  );
}
