'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Same rule as the founder landing: the 3D story is a large client-only
// chunk, so a static fallback paints the pitch and CTAs on first paint.
const ValidatorLanding = dynamic(() => import('@/components/validatorLanding/ValidatorLanding'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#f8fafc] flex items-center px-6 sm:px-16">
      <div className="max-w-xl">
        <p className="text-xs font-semibold tracking-[0.25em] text-blue-600 mb-4">FOR EXPERTS & OPERATORS</p>
        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight">Ideas are cheap. Your judgment isn&apos;t.</h1>
        <p className="text-slate-500 mt-5 text-lg">
          Score real startup ideas across 12 structured dimensions. Lend your expertise, build your public reputation.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/auth/register/validator" className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700">
            Become a Validator →
          </Link>
          <Link href="/founders" className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-full font-semibold hover:border-slate-300">
            I&apos;m a founder
          </Link>
        </div>
      </div>
    </div>
  ),
});

export default function ValidatorLandingPage() {
  return <ValidatorLanding />;
}
