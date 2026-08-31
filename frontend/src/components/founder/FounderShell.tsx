'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredUser, clearAuth } from '@/lib/auth';

// The founder counterpart of ValidatorShell: persistent sidebar on md+,
// off-canvas drawer behind a top bar on phones. Navigation is the app's
// actual routes — nothing aspirational.

// Labels are deliberately plain: a first-time founder should be able to guess
// what each page does without knowing any product jargon.
const NAV = [
  { href: '/founder', label: 'Home', exact: true },
  { href: '/founder/ideas', label: 'My Ideas' },
  { href: '/founder/surveys', label: 'Customer Surveys' },
  { href: '/founder/ip', label: 'IP & Patents' },
  { href: '/founder/surveys/generate', label: 'Write a Survey with AI' },
];

function NavItem({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-300'}`} />
      {label}
    </Link>
  );
}

export default function FounderShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const read = () => setUser(getStoredUser());
    read();
    window.addEventListener('viewas-changed', read);
    return () => window.removeEventListener('viewas-changed', read);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const logout = () => {
    clearAuth();
    router.push('/');
  };

  // Longest-prefix wins so /founder/surveys/generate lights up the AI builder,
  // not My Surveys; Overview only on the exact hub path.
  const activeHref = NAV.filter((n) => (n.exact ? pathname === n.href : pathname?.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen fixed md:sticky top-0 z-50 transition-transform duration-200 viewas-sidebar-offset ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-200">
          <Link href="/" className="text-lg font-bold text-slate-900">IdeaValidator</Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavItem key={n.href} href={n.href} label={n.label} active={activeHref === n.href} onClick={() => setOpen(false)} />
          ))}

          <div className="pt-3">
            <Link
              href="/founder/submit-idea"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 mx-1 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              + Submit New Idea
            </Link>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
            <NavItem href="/tutorial" label="Tutorial" active={false} onClick={() => setOpen(false)} />
            <NavItem href="/pricing" label="Pricing" active={false} onClick={() => setOpen(false)} />
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          {user && user.viewAs ? (
            // Honest labeling in View-as-User mode — mirrors ValidatorSidebar:
            // never reads as "logged in as", and logout is hidden because the
            // banner's Exit View Mode is the only exit.
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Admin view</p>
              <p className="text-sm font-medium text-slate-800 truncate">Viewing: {user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar — brand + hamburger; the sidebar is the drawer. */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30 viewas-sticky-offset">
          <Link href="/" className="text-lg font-bold text-slate-900">IdeaValidator</Link>
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600"
          >
            ☰
          </button>
        </div>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
