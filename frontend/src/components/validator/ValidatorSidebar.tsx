'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredUser, clearAuth } from '@/lib/auth';

export default function ValidatorSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  const logout = () => {
    clearAuth();
    router.push('/');
  };

  const isDashboardActive = pathname === '/validator/dashboard';

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onClose} />}
      <aside
        className={`w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen fixed md:sticky top-0 z-50 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-200">
          <Link href="/" className="text-lg font-bold text-slate-900">IdeaValidator</Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/validator/dashboard"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isDashboardActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDashboardActive ? 'bg-blue-600' : 'bg-slate-300'}`} />
            Dashboard
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          {user && (
            <div className="px-3 mb-2">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
