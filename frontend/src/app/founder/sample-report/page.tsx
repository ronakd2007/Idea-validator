'use client';
import Link from 'next/link';
import RadarChart from '@/components/RadarChart';
import StatusBadge from '@/components/ui/StatusBadge';

// A fully worked example report for a made-up idea. Every number here is
// hard-coded and clearly labelled as an example — it exists so a hesitant
// new user can see exactly what they get before paying for anything.
// Deliberately a static page: no API calls, no auth requirement beyond the
// founder shell, nothing that can fail or look empty.

const CATEGORIES = [
  { label: 'Market Opportunity', short: 'Market', score: 41, note: 'Lots of people have this problem' },
  { label: 'Feasibility', short: 'Feasible', score: 38, note: 'Realistic to actually build' },
  { label: 'Founder Fit', short: 'Founder', score: 35, note: 'Right background for this' },
  { label: 'Revenue Potential', short: 'Revenue', score: 24, note: 'Hard to charge much' },
  { label: 'Scalability', short: 'Scale', score: 31, note: 'Can grow without huge cost' },
  { label: 'Innovation', short: 'Original', score: 22, note: 'Similar products already exist' },
  { label: 'Social Impact', short: 'Impact', score: 28, note: 'Some wider benefit' },
  { label: 'Investor Appeal', short: 'Investor', score: 26, note: 'Investors would want more proof' },
];

const tone = (pct: number) =>
  pct >= 70 ? { text: 'text-emerald-700', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', label: 'Strong' }
  : pct >= 50 ? { text: 'text-blue-700', bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700', label: 'Okay' }
  : { text: 'text-amber-700', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', label: 'Needs work' };

export default function SampleReportPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Unmissable "this is not your data" banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-900">📋 This is an example report</p>
          <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
            A made-up idea, so you can see exactly what you get. Your own report will look like this, with your numbers.
          </p>
        </div>
        <Link href="/founder/submit-idea" className="shrink-0 text-sm bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-600 transition">
          Submit my real idea
        </Link>
      </div>

      {/* Header, mirroring the real dashboard */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <StatusBadge tone="warning" dot>Moderate Potential</StatusBadge>
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">Food &amp; Beverage</span>
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">PROTOTYPE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          LunchLoop — office lunch delivery from local home cooks
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="bg-blue-600 text-white rounded-xl p-4">
          <p className="text-[11px] font-medium text-blue-200 uppercase tracking-wide">Score out of 100</p>
          <p className="text-2xl font-bold tabular-nums mt-1">62<span className="text-sm font-medium text-blue-200">/100</span></p>
          <p className="text-[11px] text-blue-100 mt-0.5">Moderate Potential</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Experts who reviewed</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">4</p>
          <p className="text-[11px] text-slate-400 mt-0.5">industry professionals</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">People who answered</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">63</p>
          <p className="text-[11px] text-slate-400 mt-0.5">from 1 survey</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Compared to others</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">Top 30%</p>
          <p className="text-[11px] text-slate-400 mt-0.5">better than 70 out of every 100 ideas here</p>
        </div>
      </div>

      {/* The verdict — the thing a founder actually came for */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-1">The short answer</h2>
        <p className="text-xs text-slate-500 mb-4">What all the numbers below add up to, in one paragraph.</p>
        <p className="text-base text-slate-800 leading-relaxed">
          <strong className="font-semibold">People clearly have this problem, but they won&apos;t pay much to solve it.</strong>{' '}
          Office workers told us lunch is a daily annoyance — 78% said they struggle to find something good and affordable.
          But when asked about price, only 31% would pay more than $8 a meal, and your delivery costs make anything under
          $10 unprofitable. Experts liked how realistic the idea is to build, but three of the four flagged the same
          worry: thin margins in a market with big, well-funded competitors.
        </p>
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-900 mb-2">What we&apos;d do next</p>
          <ol className="space-y-2">
            {[
              'Test a $12 price point with 30 office workers before building anything — if enough say yes, the whole business changes.',
              'Try a subscription (e.g. 5 lunches a week) instead of one-off orders — it fixes the delivery-cost problem.',
              'Pick one office building and serve it properly, rather than spreading thin across a city.',
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Strength / weakness */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold uppercase tracking-wide mb-2">
            <span>▲</span> Strongest area
          </div>
          <p className="text-lg font-semibold text-slate-900">Market Opportunity</p>
          <p className="text-sm text-slate-600 mt-1">82% of max — a real, frequent problem that lots of people have.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold uppercase tracking-wide mb-2">
            <span>▼</span> Weakest area
          </div>
          <p className="text-lg font-semibold text-slate-900">Innovation</p>
          <p className="text-sm text-slate-600 mt-1">44% of max — several similar services already exist in this space.</p>
        </div>
      </div>

      {/* Score by area */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-1">Score by area</h3>
        <p className="text-xs text-slate-500 mb-6">Experts scored the idea in 8 areas, each out of 50. Longer bar = stronger area.</p>
        <div className="grid lg:grid-cols-2 gap-x-10 gap-y-5">
          {CATEGORIES.map((c) => {
            const pct = (c.score / 50) * 100;
            const t = tone(pct);
            return (
              <div key={c.label}>
                <div className="flex justify-between items-baseline mb-1 gap-2">
                  <span className="text-sm text-slate-700">{c.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.chip}`}>{t.label}</span>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{c.score}/50</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                  <div className={`h-2 rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-slate-400">{c.note}</p>
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-100 mt-6 pt-6">
          <RadarChart data={CATEGORIES.map((c) => ({ label: c.short, value: (c.score / 50) * 100 }))} />
        </div>
      </div>

      {/* What customers said */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-1">What 63 real people said</h3>
        <p className="text-xs text-slate-500 mb-5">Answers from the survey, collected through a shared link.</p>
        <div className="space-y-4">
          {[
            { q: 'Is finding a good, affordable lunch a daily struggle?', yes: 78, label: '78% said yes' },
            { q: 'Would you pay more than $8 for a home-cooked lunch delivered?', yes: 31, label: 'Only 31% said yes' },
            { q: 'Would you order at least 3 times a week?', yes: 54, label: '54% said yes' },
          ].map((row) => (
            <div key={row.q}>
              <div className="flex justify-between items-baseline gap-3 mb-1.5">
                <span className="text-sm text-slate-700">{row.q}</span>
                <span className={`text-sm font-semibold shrink-0 tabular-nums ${row.yes >= 60 ? 'text-emerald-700' : row.yes >= 40 ? 'text-blue-700' : 'text-amber-700'}`}>{row.label}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${row.yes >= 60 ? 'bg-emerald-500' : row.yes >= 40 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${row.yes}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expert comments */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-1">What the experts wrote</h3>
        <p className="text-xs text-slate-500 mb-4">In your real report you also get their name and contact details.</p>
        <div className="space-y-4">
          {[
            {
              who: 'Restaurant operations consultant, 12 years',
              strength: 'Home cooks give you food quality chains genuinely cannot match, at a lower cost base.',
              weakness: 'Delivery economics. At $8 a meal you lose money on every single order once you pay the driver.',
              fix: 'Test a weekly subscription with fixed delivery windows — batch the drops to one building.',
            },
            {
              who: 'Food-tech founder, previously scaled a delivery startup',
              strength: 'The daily-habit angle is strong. Lunch repeats five times a week without you doing marketing.',
              weakness: 'Big players can undercut you on price for as long as it takes to push you out.',
              fix: 'Do not compete on price. Compete on food people cannot get anywhere else.',
            },
          ].map((e, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-900 mb-3 pb-3 border-b border-slate-100">{e.who}</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-1"><span>▲</span>What&apos;s good</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{e.strength}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mb-1"><span>▼</span>What&apos;s weak</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{e.weakness}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-1"><span>→</span>What to fix</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{e.fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Close */}
      <div className="bg-white border border-slate-200 rounded-xl p-7 text-center">
        <h3 className="text-lg font-bold text-slate-900">Want this for your idea?</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          Expert review is $29.99 for one idea, one time. Customer surveys are free to start —
          you can run one right now without paying anything.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <Link href="/founder/submit-idea" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 text-sm transition">
            Submit my idea
          </Link>
          <Link href="/founder/surveys" className="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-slate-50 text-sm transition">
            Try a free survey first
          </Link>
        </div>
      </div>
    </div>
  );
}
