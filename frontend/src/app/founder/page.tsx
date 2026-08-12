'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser } from '@/lib/auth';

export default function FounderHubPage() {
  const router = useRouter();
  const [name, setName] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    setName(user.name || '');
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900">{name ? `Welcome back, ${name}` : 'Welcome back'}</h1>
        <p className="text-slate-500 mt-2">How do you want to validate your idea today?</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Link
          href="/founder/ideas"
          className="group bg-white border border-slate-200 shadow-sm rounded-2xl p-8 hover:border-blue-300 hover:shadow-md transition"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-5">🎯</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Validate My Idea</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">
            Submit your idea and get structured, expert feedback across 12 scoring frameworks — market opportunity,
            feasibility, founder fit, and more.
          </p>
          <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">Go to Expert Validation &rarr;</span>
        </Link>

        <Link
          href="/founder/surveys"
          className="group bg-white border border-slate-200 shadow-sm rounded-2xl p-8 hover:border-blue-300 hover:shadow-md transition"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-5">📋</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Mass Survey</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">
            Build your own custom survey and collect real responses from your target market — questions, analytics,
            and validation evidence, all in one place.
          </p>
          <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">Go to Mass Survey &rarr;</span>
        </Link>
      </div>

      <p className="text-center text-xs text-slate-400 mt-10">You can always switch between the two — they&apos;re independent evidence sources for the same idea.</p>
    </div>
  );
}
