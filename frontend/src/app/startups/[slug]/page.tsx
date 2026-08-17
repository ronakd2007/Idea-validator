'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { lookingForLabel, stageLabel } from '@/lib/startupTypes';
import { Skeleton } from '@/components/ui/Skeleton';

// Startup-first profile: the company's own story leads, and validation is one
// modest section near the end — a trust marker, never the headline.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4">
      <h2 className="font-semibold text-slate-900 mb-2">{title}</h2>
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{children}</div>
    </section>
  );
}

export default function PublicStartupProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [s, setS] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getPublicStartup(slug).then(setS).catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-lg font-semibold text-slate-900 mb-2">Startup not found</p>
          <p className="text-sm text-slate-500 mb-6">This listing may have been removed, or the link is incorrect.</p>
          <Link href="/startups" className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700">
            Browse all startups
          </Link>
        </div>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const info: [string, string][] = [
    ['Industry', s.industry],
    ['Location', s.location],
    ['Stage', s.stage ? stageLabel(s.stage) : ''],
    ['Founded', s.foundedYear ? String(s.foundedYear) : ''],
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Link href="/startups" className="text-sm text-slate-500 hover:text-slate-800">&larr; All startups</Link>

        {/* Header */}
        <header className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-7 mt-4 mb-4">
          <div className="flex items-start gap-4 flex-wrap">
            <span className="w-16 h-16 rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-300">🏢</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{s.name}</h1>
              {s.tagline && <p className="text-slate-600 mt-1 leading-relaxed">{s.tagline}</p>}
              <p className="text-sm text-slate-500 mt-2">
                {[s.industry, s.location].filter(Boolean).join(' · ')}
                {s.stage && <span className="text-slate-400"> · {stageLabel(s.stage)}</span>}
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {s.website && (
                  <a href={s.website} target="_blank" rel="noopener noreferrer nofollow"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium">Website ↗</a>
                )}
                {s.linkedinUrl && (
                  <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium">LinkedIn ↗</a>
                )}
              </div>
            </div>
          </div>
        </header>

        {s.about && <Section title="About">{s.about}</Section>}
        {s.problem && <Section title="Problem">{s.problem}</Section>}
        {s.solution && <Section title="Solution">{s.solution}</Section>}
        {s.product && <Section title="Product">{s.product}</Section>}
        {s.traction && <Section title="Traction">{s.traction}</Section>}

        {s.teamMembers?.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4">
            <h2 className="font-semibold text-slate-900 mb-3">Team</h2>
            <ul className="space-y-2">
              {s.teamMembers.map((m: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                  <span className="text-slate-800 font-medium">{m.name}</span>
                  {m.linkedinUrl && (
                    <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow"
                      className="text-blue-600 hover:text-blue-700">LinkedIn ↗</a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Startup Information</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {info.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{k}</dt>
                <dd className="text-sm text-slate-800 mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Validation — deliberately low on the page and entirely optional */}
        {s.validation && (
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4">
            <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <span className="text-emerald-600">✓</span> Validation
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              This startup&apos;s idea was independently reviewed by industry experts on IdeaValidator.
            </p>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {s.validation.score != null && (
                <div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{s.validation.score}<span className="text-sm text-slate-400">/100</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">Validation score</p>
                </div>
              )}
              {s.validation.validatorCount != null && (
                <div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{s.validation.validatorCount}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Expert reviewer{s.validation.validatorCount === 1 ? '' : 's'}</p>
                </div>
              )}
            </div>
            {s.validation.customerValidation && (
              <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
                {([
                  ['Would use it', s.validation.customerValidation.wouldUse],
                  ['Would pay', s.validation.customerValidation.wouldPay],
                  ['Would recommend', s.validation.customerValidation.wouldRecommend],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xl font-bold text-slate-900 tabular-nums">{val}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {s.lookingFor?.length > 0 && (
          <section className="bg-blue-50 border border-blue-100 rounded-xl p-6">
            <h2 className="font-semibold text-blue-900 mb-1">Looking for</h2>
            <p className="text-xs text-blue-800/80 mb-4">Get in touch if you can help with any of these.</p>
            <div className="flex flex-wrap gap-2">
              {s.lookingFor.map((l: string) => (
                <span key={l} className="text-sm bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
                  {lookingForLabel(l)}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
