'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// The role gate is a 3D chunk like the landings — while it downloads, this
// static fallback shows the same choice as plain links, so the page is usable
// from the very first paint even on a slow connection.
const LandingGate = dynamic(() => import('@/components/gate/LandingGate'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold tracking-[0.3em] text-blue-600 mb-3">IDEAVALIDATOR</p>
      <h1 className="text-4xl sm:text-6xl font-semibold text-slate-900 tracking-tight leading-tight">Every idea has two sides.</h1>
      <p className="mt-3 text-lg text-slate-500 mb-10">Which one are you?</p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/founders" className="bg-slate-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-slate-800">
          I have an idea →
        </Link>
        <Link href="/validators" className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700">
          I evaluate ideas →
        </Link>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return <LandingGate />;
}
