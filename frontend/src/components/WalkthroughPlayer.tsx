'use client';
import { useState } from 'react';

// The walkthrough is a self-contained animated demo (~1.2MB) served from
// /public/walkthrough.html. It loads only after the visitor clicks play, so a
// page carrying this component stays as light as it was before.
export default function WalkthroughPlayer() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 aspect-video">
      {playing ? (
        <iframe
          src="/walkthrough.html"
          title="IdeaValidator product walkthrough"
          className="absolute inset-0 w-full h-full border-0"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play the IdeaValidator walkthrough"
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-4 text-center px-6 group"
        >
          <span className="w-16 h-16 rounded-full bg-white/95 group-hover:bg-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
            <span className="ml-1 border-y-[11px] border-y-transparent border-l-[18px] border-l-slate-900" />
          </span>
          <span>
            <span className="block text-white font-semibold text-lg">Watch the 75-second walkthrough</span>
            <span className="block text-slate-300 text-sm mt-1">See exactly how it works before you sign up</span>
          </span>
        </button>
      )}
    </div>
  );
}
