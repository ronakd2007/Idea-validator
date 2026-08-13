'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getRealUser, getViewContext, clearViewContext, type ViewAsContext } from '@/lib/auth';

/**
 * The persistent ADMIN VIEW MODE indicator. Fixed above every sticky header
 * (they top out at z-50), no dismiss control — it disappears only when view
 * mode ends. Always names BOTH identities: the real signed-in admin and the
 * user being viewed.
 *
 * On /admin routes it switches to an "armed" variant, because admin pages
 * always operate as the real admin — the banner says so instead of letting
 * the admin wonder which identity a page is using.
 */
export default function ViewAsBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [ctx, setCtx] = useState<ViewAsContext | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const current = getViewContext();
      setCtx(current);
      setMinutesLeft(current ? Math.max(0, Math.ceil((new Date(current.expiresAt).getTime() - Date.now()) / 60_000)) : null);
    };
    read();
    window.addEventListener('viewas-changed', read);
    window.addEventListener('storage', read);
    const tick = setInterval(read, 15_000); // keeps the "Xm left" countdown fresh
    return () => {
      window.removeEventListener('viewas-changed', read);
      window.removeEventListener('storage', read);
      clearInterval(tick);
    };
  }, []);

  // Self-exit on expiry: getViewContext() already clears expired contexts, so
  // detect the transition from "had ctx" to "expired" here.
  useEffect(() => {
    if (!ctx) return;
    const ms = new Date(ctx.expiresAt).getTime() - Date.now();
    if (ms <= 0) { onExpired(); return; }
    const t = setTimeout(onExpired, ms + 500);
    return () => clearTimeout(t);
    function onExpired() {
      clearViewContext();
      alert('View as User session expired.');
      router.push('/admin');
    }
  }, [ctx, router]);

  // Keep every sticky header below the banner honest about the extra 44px.
  useEffect(() => {
    const root = document.documentElement;
    if (ctx) root.setAttribute('data-viewas', 'true');
    else root.removeAttribute('data-viewas');
    return () => root.removeAttribute('data-viewas');
  }, [ctx]);

  if (!ctx) return null;

  const real = getRealUser();
  const onAdminRoute = pathname?.startsWith('/admin');

  const exit = async () => {
    const targetId = ctx.target.id;
    clearViewContext(); // synchronous, before anything else — no stale state
    api.endViewAs(targetId).catch(() => {}); // audit log, best-effort
    router.push('/admin');
  };

  const resumeHref = ctx.target.role === 'VALIDATOR' ? '/validator/dashboard' : '/founder';

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 shadow-md" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
            <span className="shrink-0 font-black tracking-wide bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-[10px] sm:text-xs">
              ADMIN VIEW MODE
            </span>
            {onAdminRoute ? (
              <span className="truncate">
                This page runs as <strong>{real?.name || 'you'} (ADMIN)</strong> — view of <strong>{ctx.target.name}</strong> is paused
              </span>
            ) : (
              <span className="truncate">
                Signed in: <strong>{real?.name || 'Admin'} (ADMIN)</strong>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">Viewing: <strong>{ctx.target.name} ({ctx.target.role}{ctx.target.isActive === false ? ' · deactivated' : ''})</strong></span>
              </span>
            )}
            {minutesLeft != null && <span className="hidden md:inline shrink-0 text-amber-900/70">· {minutesLeft}m left</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onAdminRoute && (
              <button onClick={() => router.push(resumeHref)}
                className="text-xs font-semibold bg-amber-100 hover:bg-amber-50 border border-amber-700/30 px-2.5 py-1 rounded">
                Resume View
              </button>
            )}
            <button onClick={exit}
              className="text-xs font-bold bg-amber-950 text-white hover:bg-amber-900 px-2.5 py-1 rounded">
              Exit View Mode
            </button>
          </div>
        </div>
      </div>
      {/* Spacer so page content starts below the fixed banner */}
      <div className="h-11" aria-hidden="true" />
    </>
  );
}
