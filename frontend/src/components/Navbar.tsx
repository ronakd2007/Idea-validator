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
    setUser(getStoredUser());
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

  return (
    <nav className={`px-4 sm:px-6 py-4 flex items-center justify-between gap-3 transition-all duration-300 ${
      isHome
        ? 'absolute top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-sm border-b border-slate-200/70'
        : 'bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50'
    }`}>
      <Link href="/" className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">IdeaValidator</Link>
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {user ? (
          <>
            <Link href={dashLink()} className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Dashboard</Link>
            {user.role === 'FOUNDER' && (
              <Link href="/founder/surveys" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">My Surveys</Link>
            )}
            <span className="hidden md:inline text-sm text-slate-500 truncate max-w-[140px]">Hi, {user.name}</span>
            <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap shrink-0">{user.role}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:text-red-700 whitespace-nowrap shrink-0">Logout</button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap">Login</Link>
            <Link href="/auth/register/founder" className="text-sm px-3 sm:px-4 py-2 rounded-lg transition bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap shrink-0">Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
