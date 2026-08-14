'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredUser, clearAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const read = () => setUser(getStoredUser());
    read();
    // Re-read identity the instant view mode starts or ends in this tab.
    window.addEventListener('viewas-changed', read);
    return () => window.removeEventListener('viewas-changed', read);
  }, [pathname]);

  // the validator experience has its own sidebar + header shell
  if (pathname?.startsWith('/validator')) return null;
  // public respondents never see the founder-app chrome
  if (pathname?.startsWith('/survey/')) return null;

  const logout = () => {
    clearAuth();
    setUser(null);
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

  return (
    <nav className={`px-4 sm:px-6 py-4 flex items-center justify-between gap-3 transition-all duration-300 ${
      isHome
        ? 'absolute top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-sm border-b border-slate-200/70 viewas-sticky-offset'
        : 'bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50 viewas-sticky-offset'
    }`}>
      <Link href="/" className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">IdeaValidator</Link>
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {user ? (
          <>
            <Link href={dashLink()} className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Dashboard</Link>
            {user.role === 'FOUNDER' && (
              <Link href="/founder/surveys" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">My Surveys</Link>
            )}
            <Link href="/tutorial" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Tutorial</Link>
            <Link href="/pricing" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Pricing</Link>
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
                <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap shrink-0">{user.role}</span>
                <button onClick={logout} className="text-sm text-red-600 hover:text-red-700 whitespace-nowrap shrink-0">Logout</button>
              </>
            )}
          </>
        ) : (
          <>
            <Link href="/tutorial" className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Tutorial</Link>
            <Link href="/pricing" className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Pricing</Link>
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Login</Link>
            <Link href="/auth/register/founder" className="text-sm px-3 sm:px-4 py-2 rounded-lg transition bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap shrink-0">Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
