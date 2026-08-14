'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredUser, clearAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const read = () => setUser(getStoredUser());
    read();
    // Re-read identity the instant view mode starts or ends in this tab.
    window.addEventListener('viewas-changed', read);
    return () => window.removeEventListener('viewas-changed', read);
  }, [pathname]);

  // Every navigation closes the mobile dropdown — without this it would
  // stay open (and stale) after tapping a link inside it.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // the validator and founder experiences have their own sidebar shells
  if (pathname?.startsWith('/validator')) return null;
  if (pathname?.startsWith('/founder')) return null;
  // public respondents never see the founder-app chrome
  if (pathname?.startsWith('/survey/')) return null;

  const logout = () => {
    clearAuth();
    setUser(null);
    setMenuOpen(false);
    router.push('/');
  };

  const dashLink = () => {
    if (!user) return '/';
    if (user.role === 'FOUNDER') return '/founder';
    if (user.role === 'VALIDATOR') return '/validator/dashboard';
    if (user.role === 'ADMIN') return '/admin';
    return '/';
  };

  const isHome = pathname === '/';

  const inViewMode = !!user?.viewAs;

  const linkCls = 'text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap';

  return (
    <div className="relative">
      <nav className={`px-4 sm:px-6 py-4 flex items-center justify-between gap-3 transition-all duration-300 ${
        isHome
          ? 'absolute top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-sm border-b border-slate-200/70 viewas-sticky-offset'
          : 'bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50 viewas-sticky-offset'
      }`}>
        <Link href="/" className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">IdeaValidator</Link>

        {/* Tablet and up: the full row. Unchanged from before — every link
            always present, just gated by breakpoint like it always was. */}
        <div className="hidden sm:flex items-center gap-4 min-w-0">
          {user ? (
            <>
              <Link href={dashLink()} className={linkCls}>Dashboard</Link>
              {user.role === 'FOUNDER' && (
                <Link href="/founder/surveys" className={linkCls}>My Surveys</Link>
              )}
              <Link href="/tutorial" className={linkCls}>Tutorial</Link>
              <Link href="/pricing" className={linkCls}>Pricing</Link>
              {inViewMode ? (
                // Never impersonate: this is the viewed user's page, not their
                // session. The amber treatment matches the banner; logout is
                // hidden because the banner's Exit View Mode is the only exit.
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shrink-0 font-semibold">
                  👁 Viewing: {user.name} · {user.role}
                </span>
              ) : (
                <>
                  <span className="hidden md:inline text-sm text-slate-500 truncate max-w-[140px]">Hi, {user.name}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap shrink-0">{user.role}</span>
                  <button onClick={logout} className="text-sm text-red-600 hover:text-red-700 whitespace-nowrap shrink-0">Logout</button>
                </>
              )}
            </>
          ) : (
            <>
              <Link href="/tutorial" className={linkCls}>Tutorial</Link>
              <Link href="/pricing" className={linkCls}>Pricing</Link>
              <Link href="/auth/login" className={linkCls}>Login</Link>
              <Link href="/auth/register/founder" className="text-sm px-3 sm:px-4 py-2 rounded-lg transition bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap shrink-0">Get Started</Link>
            </>
          )}
        </div>

        {/* Phones: one primary action stays visible, everything else moves
            into the dropdown below so nothing gets squeezed off-screen. */}
        <div className="flex sm:hidden items-center gap-2 shrink-0">
          {user && !inViewMode && (
            <Link href={dashLink()} className="text-sm font-medium text-slate-700 whitespace-nowrap">Dashboard</Link>
          )}
          {inViewMode && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap font-semibold">
              👁 {user.role}
            </span>
          )}
          {!user && (
            <Link href="/auth/register/founder" className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold whitespace-nowrap">Get Started</Link>
          )}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 text-base shrink-0"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown — absolutely positioned so opening it never shifts
          page content underneath. */}
      {menuOpen && (
        <div className="sm:hidden absolute inset-x-0 top-full z-50 bg-white border-b border-slate-200 shadow-lg px-4 py-3 flex flex-col gap-1 viewas-sticky-offset">
          {user ? (
            <>
              {user.role === 'FOUNDER' && (
                <Link href="/founder/surveys" className="py-2 text-sm text-slate-700" onClick={() => setMenuOpen(false)}>My Surveys</Link>
              )}
              <Link href="/tutorial" className="py-2 text-sm text-slate-700" onClick={() => setMenuOpen(false)}>Tutorial</Link>
              <Link href="/pricing" className="py-2 text-sm text-slate-700" onClick={() => setMenuOpen(false)}>Pricing</Link>
              {!inViewMode && (
                <>
                  <div className="py-2 text-sm text-slate-500 border-t border-slate-100 mt-1 pt-3">
                    Signed in as {user.name} · <span className="text-blue-700">{user.role}</span>
                  </div>
                  <button onClick={logout} className="py-2 text-left text-sm text-red-600 font-medium">Logout</button>
                </>
              )}
            </>
          ) : (
            <>
              <Link href="/tutorial" className="py-2 text-sm text-slate-700" onClick={() => setMenuOpen(false)}>Tutorial</Link>
              <Link href="/pricing" className="py-2 text-sm text-slate-700" onClick={() => setMenuOpen(false)}>Pricing</Link>
              <Link href="/auth/login" className="py-2 text-sm text-slate-700 border-t border-slate-100 mt-1 pt-3" onClick={() => setMenuOpen(false)}>Login</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
