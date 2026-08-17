'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LOOKING_FOR_OPTIONS, lookingForLabel, stageLabel } from '@/lib/startupTypes';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

interface Card {
  slug: string; name: string; logoUrl: string; tagline: string;
  industry: string; location: string; stage: string;
  lookingFor: string[]; validated: boolean; score: number | null;
}

export default function StartupDirectoryPage() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [opts, setOpts] = useState<{ industries: string[]; locations: string[]; stages: string[] }>({ industries: [], locations: [], stages: [] });
  const [filters, setFilters] = useState({ industry: '', location: '', stage: '', lookingFor: '' });

  useEffect(() => {
    let cancelled = false;
    api.getPublicStartups(filters)
      .then((res: any) => {
        if (cancelled) return;
        setCards(res.startups || []);
        // Options come from the unfiltered set on first load only, so the
        // dropdowns don't collapse to a single value as you filter.
        setOpts((prev) =>
          prev.industries.length || prev.locations.length || prev.stages.length ? prev : res.filters || prev
        );
      })
      .catch(() => { if (!cancelled) setCards([]); });
    return () => { cancelled = true; };
  }, [filters]);

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const clear = () => setFilters({ industry: '', location: '', stage: '', lookingFor: '' });
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">Discover Startups</h1>
        <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
          Explore startups that are building, validating, and growing new ideas.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={filters.industry} onChange={(e) => set('industry', e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white">
              <option value="">All industries</option>
              {opts.industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <select value={filters.location} onChange={(e) => set('location', e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white">
              <option value="">All locations</option>
              {opts.locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={filters.stage} onChange={(e) => set('stage', e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white">
              <option value="">Any stage</option>
              {opts.stages.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
            <select value={filters.lookingFor} onChange={(e) => set('lookingFor', e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white">
              <option value="">Looking for anything</option>
              {LOOKING_FOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {active && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">{cards?.length ?? 0} startup{cards?.length === 1 ? '' : 's'} match</span>
              <button onClick={clear} className="text-xs text-blue-600 hover:underline font-medium">Clear filters</button>
            </div>
          )}
        </div>

        {cards === null ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
          </div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon="🚀"
            title={active ? 'No startups match these filters' : 'No startups listed yet'}
            body={active
              ? 'Try clearing a filter to see more.'
              : 'Startups appear here once founders validate their idea and their listing is approved.'}
            action={active
              ? <button onClick={clear} className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700">Clear filters</button>
              : <Link href="/auth/register/founder" className="inline-block text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700">Validate your idea</Link>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((s) => (
              <Link key={s.slug} href={`/startups/${s.slug}`}
                className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-12 h-12 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                    {s.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg text-slate-300">🏢</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-slate-900 leading-tight truncate">{s.name}</h2>
                    {s.validated && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1">
                        ✓ Validated{s.score != null ? ` · ${s.score}/100` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{s.tagline}</p>

                <p className="text-xs text-slate-500 mt-3">
                  {[s.industry, s.location].filter(Boolean).join(' · ')}
                  {s.stage && <span className="text-slate-400"> · {stageLabel(s.stage)}</span>}
                </p>

                {s.lookingFor.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Looking for</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.lookingFor.map((l) => (
                        <span key={l} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {lookingForLabel(l)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <span className="mt-4 text-sm font-semibold text-blue-600 group-hover:text-blue-700">View Startup &rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
