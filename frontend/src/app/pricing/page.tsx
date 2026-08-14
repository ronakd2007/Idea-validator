import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — IdeaValidator',
  description:
    'Simple pricing: one flat fee to validate an idea with experts, and per-survey plans for collecting public feedback — starting free.',
};

// Fully static, public page. Prices here are the single source of marketing
// truth; the idea fee itself is charged server-side from IDEA_SUBMISSION_FEE.

const CHECK = <span className="text-emerald-500 font-bold mr-2">✓</span>;

function Feature({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start text-sm text-slate-600 leading-relaxed">{CHECK}<span>{children}</span></li>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">Simple, honest pricing</h1>
        <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
          One flat fee to validate an idea with experts. Simple monthly plans for surveys — cancel anytime.
        </p>
      </section>

      {/* Idea validation — the flagship, one payment */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-blue-600 rounded-2xl p-8 sm:p-10 text-white">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-2">Expert Idea Validation</p>
              <h2 className="text-2xl font-bold">Validate your idea. Everything included.</h2>
              <ul className="mt-4 space-y-1.5 text-sm text-blue-100">
                <li>✓ Structured review by approved industry experts across 12 frameworks</li>
                <li>✓ Full validation dashboard — scores, radar, risk heatmap</li>
                <li>✓ Validation Weakness Detector &amp; Assumption Checker verdicts</li>
                <li>✓ AI summary, percentile benchmark &amp; “Why this score?”</li>
                <li>✓ Investor-ready PDF report &amp; shareable public validation page</li>
                <li>✓ Revise &amp; re-validate later at 60% off</li>
              </ul>
            </div>
            <div className="text-right shrink-0">
              <div className="text-4xl font-black">$29.99</div>
              <div className="text-blue-200 text-sm">one-time, per idea</div>
              <Link href="/auth/register/founder" className="inline-block mt-4 bg-white text-blue-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-50">
                Validate my idea →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Survey plans */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Mass Surveys</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Monthly plans. Start free.</h2>
          <p className="text-slate-500 mt-2">Pick the size that matches your research — upgrade or cancel anytime.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {/* Free */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
            <h3 className="font-bold text-slate-900 text-lg">Free</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">For small, basic surveys.</p>
            <div className="mb-5"><span className="text-3xl font-black text-slate-900">$0</span></div>
            <ul className="space-y-2 flex-1">
              <Feature>1 survey</Feature>
              <Feature>Up to 50 responses</Feature>
              <Feature>Basic question types</Feature>
              <Feature>Basic results &amp; analytics</Feature>
              <Feature>Basic response viewer</Feature>
              <Feature>AI Form Builder</Feature>
              <Feature>Shareable survey link</Feature>
            </ul>
            <Link href="/auth/register/founder" className="mt-6 text-center border border-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-50 text-sm">
              Start free
            </Link>
          </div>

          {/* Survey — the main option */}
          <div className="bg-white border-2 border-blue-600 rounded-2xl p-6 flex flex-col relative shadow-md">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
            <h3 className="font-bold text-slate-900 text-lg">Survey</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">For founders who want meaningful public feedback.</p>
            <div className="mb-5">
              <span className="text-3xl font-black text-slate-900">$3</span>
              <span className="text-sm text-slate-500"> / month</span>
            </div>
            <ul className="space-y-2 flex-1">
              <Feature>10 surveys per month</Feature>
              <Feature>Up to 500 responses per survey</Feature>
              <Feature>Unlimited questions</Feature>
              <Feature>AI Form Builder</Feature>
              <Feature>All question types</Feature>
              <Feature>Response analytics</Feature>
              <Feature>Response quality analysis</Feature>
              <Feature>Respondent segmentation</Feature>
              <Feature>Question impact analysis</Feature>
              <Feature>Export responses (CSV)</Feature>
              <Feature>Shareable survey + QR code</Feature>
            </ul>
            <Link href="/auth/register/founder" className="mt-6 text-center bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 text-sm">
              Get started →
            </Link>
          </div>

          {/* Survey Pro */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
            <h3 className="font-bold text-slate-900 text-lg">Survey Pro</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">For larger research.</p>
            <div className="mb-5">
              <span className="text-3xl font-black text-slate-900">$5</span>
              <span className="text-sm text-slate-500"> / month</span>
            </div>
            <ul className="space-y-2 flex-1">
              <Feature>Up to 2,000 responses</Feature>
              <Feature>Everything in Survey</Feature>
              <Feature>Advanced response behavior analytics</Feature>
              <Feature>A/B question testing</Feature>
              <Feature>Advanced segmentation</Feature>
              <Feature>Giveaway / incentive support</Feature>
              <Feature>Advanced analytics</Feature>
              <Feature>Priority processing</Feature>
            </ul>
            <Link href="/auth/register/founder" className="mt-6 text-center border border-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-50 text-sm">
              Get started
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Prices in USD. Survey plans bill monthly — cancel anytime. Idea validation stays a one-time fee per idea. Anonymous responses are always supported on every plan.
        </p>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900">Not sure where to start?</h2>
          <p className="text-slate-500 mt-1 text-sm">Run a free survey first — upgrade only when the responses start coming in.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <Link href="/auth/register/founder" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 text-sm">Create free account</Link>
            <Link href="/tutorial" className="border border-slate-300 text-slate-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-slate-50 text-sm">How it works</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
