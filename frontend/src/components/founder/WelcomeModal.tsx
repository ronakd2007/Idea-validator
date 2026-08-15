'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const SEEN_KEY = 'iv_welcome_seen';

// Shown once, on a founder's first visit to the app. Its whole job is to
// answer the three questions a brand-new user has before they can act:
// what does this do, what will it cost, and what do I do first.
const SLIDES = [
  {
    emoji: '💡',
    title: 'Find out if your idea is worth building',
    body: 'Most people build first and discover the problems later. IdeaValidator flips that around — you get honest feedback before you spend your time and money.',
    detail: null as string | null,
  },
  {
    emoji: '🔍',
    title: 'Two kinds of proof',
    body: 'Experts score your idea across the things that make businesses work or fail. Real people answer your survey and tell you if they actually want it.',
    detail: 'You can do either one on its own — or both, which is when the picture gets really clear.',
  },
  {
    emoji: '✅',
    title: 'You get a clear answer',
    body: 'A simple report: what\'s strong, what\'s weak, and what to do next. No jargon — and you can ask our AI assistant anything about your results in plain English.',
    detail: 'Surveys are free to start. Expert review costs $29.99 for one idea, one time.',
  },
];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SEEN_KEY) !== 'true') setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, 'true');
    setOpen(false);
  };

  if (!open) return null;
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[85] bg-slate-900/50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 sm:p-8">
        <div className="text-4xl mb-4">{slide.emoji}</div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-3">{slide.title}</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{slide.body}</p>
        {slide.detail && <p className="text-sm text-slate-500 leading-relaxed mt-3">{slide.detail}</p>}

        <div className="flex items-center justify-center gap-1.5 mt-7 mb-6">
          {SLIDES.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={dismiss} className="text-sm text-slate-400 hover:text-slate-600 font-medium">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="text-sm px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">
                Back
              </button>
            )}
            {isLast ? (
              <button onClick={dismiss} className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
                Let&apos;s start
              </button>
            ) : (
              <button onClick={() => setStep((s) => s + 1)} className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
                Next
              </button>
            )}
          </div>
        </div>

        {isLast && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Curious what a finished report looks like?{' '}
            <Link href="/founder/sample-report" onClick={dismiss} className="text-blue-600 hover:underline font-medium">
              See an example
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
