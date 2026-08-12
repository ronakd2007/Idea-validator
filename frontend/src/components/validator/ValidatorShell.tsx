'use client';
import { useState } from 'react';
import ValidatorSidebar from './ValidatorSidebar';

export default function ValidatorShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <ValidatorSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <span className="text-base font-bold text-slate-900">IdeaValidator</span>
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -mr-2 text-slate-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
