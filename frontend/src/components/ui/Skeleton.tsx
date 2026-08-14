// Skeleton loaders shaped like the content they replace — pages compose the
// primitives so the loading layout matches the final layout, not a spinner.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function SkeletonText({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

// A generic list-row card: title line, meta line, text — the shape of the
// ideas and surveys list rows.
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-5 w-1/3 mb-3" />
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <SkeletonText lines={2} />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
  );
}
