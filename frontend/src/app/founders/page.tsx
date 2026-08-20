'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// The founder story lives here now that / is the role gate. Same rule as
// before: the 3D landing is a large client-only chunk, so a static fallback
// paints the headline and CTAs instantly while it downloads.
const IdeaValidatorLanding = dynamic(() => import('@/components/landing/IdeaValidatorLanding'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#f8fafc] flex items-center px-6 sm:px-16">
      <div className="max-w-xl">
        <p className="text-xs font-semibold tracking-[0.25em] text-blue-600 mb-4">THE IDEA</p>
        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight">Validate Before You Build.</h1>
        <p className="text-slate-500 mt-5 text-lg">
          Get structured, expert feedback on your business idea before you invest your time and money.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/auth/register/founder" className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700">
            Validate My Idea →
          </Link>
          <Link href="/auth/register/validator" className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-full font-semibold hover:border-slate-300">
            Become a Validator
          </Link>
        </div>
      </div>
    </div>
  ),
});

export default function FounderLandingPage() {
  return <IdeaValidatorLanding />;
}
