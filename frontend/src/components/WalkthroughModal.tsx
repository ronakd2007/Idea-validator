'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// "Watch demo" trigger + full-screen overlay player, kept in one component so
// it can be dropped anywhere (currently the landing page's CTA rows) without
// prop-drilling open/close state through the 3D scene.
//
// The demo itself is the self-contained animated page at /walkthrough.html
// (~1.2MB). The iframe only mounts once the overlay opens, so a page carrying
// this button downloads nothing extra until someone actually asks for it.
export default function WatchDemoButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    // The landing page is a fixed 3D canvas; locking scroll keeps the scene
    // from advancing behind the overlay while the demo plays.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center gap-2.5 bg-white border border-slate-300 text-slate-900 px-6 py-3.5 rounded-full text-sm font-semibold hover:border-slate-400 transition-colors duration-300 ${className}`}
      >
        <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <span className="ml-0.5 border-y-[5px] border-y-transparent border-l-[8px] border-l-white" />
        </span>
        Watch demo
      </button>

      {/* Portalled to <body>: the landing page renders this button inside a
          transformed container, and a CSS transform makes that ancestor the
          containing block for position:fixed children — without the portal the
          overlay is trapped inside the headline column instead of covering the
          viewport. */}
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[95] bg-slate-950/90 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="IdeaValidator product walkthrough"
        >
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="text-white font-semibold text-sm sm:text-base">How IdeaValidator works — 75 seconds</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close demo"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-2xl">
              <iframe
                src="/walkthrough.html"
                title="IdeaValidator product walkthrough"
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
