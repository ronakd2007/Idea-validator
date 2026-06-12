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

  const logout = () => {
    clearAuth();
    setUser(null);
    router.push('/');
  };

  const dashLink = () => {
    if (!user) return '/';
    if (user.role === 'FOUNDER') return '/founder/ideas';
    if (user.role === 'VALIDATOR') return '/validator/dashboard';
    if (user.role === 'ADMIN') return '/admin';
    return '/';
  };

  const isHome = pathname === '/';

  return (
    <nav className={`px-6 py-4 flex items-center justify-between transition-all duration-300 ${
      isHome
        ? 'absolute top-0 left-0 right-0 z-50 bg-transparent border-b border-white/10'
        : 'bg-white border-b border-gray-200'
    }`}>
      <Link href="/" className={`text-xl font-bold ${isHome ? 'text-white' : 'text-indigo-600'}`}>IdeaValidator</Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link href={dashLink()} className={`text-sm ${isHome ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-indigo-600'}`}>Dashboard</Link>
            <span className={`text-sm ${isHome ? 'text-gray-400' : 'text-gray-500'}`}>Hi, {user.name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${isHome ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'}`}>{user.role}</span>
            <button onClick={logout} className="text-sm text-red-400 hover:text-red-300">Logout</button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className={`text-sm ${isHome ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-indigo-600'}`}>Login</Link>
            <Link href="/auth/register/founder" className={`text-sm px-4 py-2 rounded-lg transition ${isHome ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
