'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonStatRow, Skeleton } from '@/components/ui/Skeleton';

type Attention = {
  key: string;
  tone: 'warning' | 'info';
  text: string;
  href: string;
  cta: string;
};

// The overview answers three questions with data the app already has:
// what's happening (stats), what needs me (attention list), what next (CTA).
// Every rule below is derived client-side from the two list endpoints —
// no new API surface.
function computeAttention(ideas: any[], surveys: any[]): Attention[] {
  const items: Attention[] = [];

  for (const idea of ideas) {
    if (idea.paymentStatus !== 'COMPLETED') {
      items.push({
        key: `pay-${idea.id}`,
        tone: 'warning',
        text: `"${idea.title}" is waiting on payment — expert validation hasn't started.`,
        href: `/founder/submit-idea?pay=${idea.id}`,
        cta: 'Complete payment',
      });
    } else if ((idea._count?.validations ?? 0) === 0) {
      items.push({
        key: `noval-${idea.id}`,
        tone: 'info',
        text: `"${idea.title}" is with our experts — no validations in yet. Collect survey responses meanwhile.`,
        href: `/founder/ideas/${idea.id}/dashboard`,
        cta: 'Open dashboard',
      });
    }
  }

  for (const s of surveys) {
    const responses = s._count?.responses ?? 0;
    if (s.status === 'DRAFT') {
      items.push({
        key: `draft-${s.id}`,
        tone: 'warning',
        text: `Survey "${s.title}" is still a draft — nobody can respond until you publish it.`,
        href: `/founder/surveys/${s.id}/edit`,
        cta: 'Finish & publish',
      });
    } else if (s.status === 'LIVE' && responses === 0) {
      items.push({
        key: `noresp-${s.id}`,
        tone: 'info',
        text: `"${s.title}" is live but has no responses yet — share the link or QR code.`,
        href: `/founder/surveys`,
        cta: 'Share survey',
      });
    } else if (s.status === 'LIVE' && s.responseLimit != null && responses >= s.responseLimit) {
      items.push({
        key: `limit-${s.id}`,
        tone: 'warning',
        text: `"${s.title}" hit its response limit (${s.responseLimit}) — close it or raise the limit.`,
        href: `/founder/surveys/${s.id}/analytics`,
        cta: 'Review results',
      });
    }
  }

  return items.slice(0, 5);
}

export default function FounderOverviewPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [surveys, setSurveys] = useState<any[] | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    setName(user.name || '');
    api.getMyIdeas().then(setIdeas).catch(() => setIdeas([]));
    api.getMySurveys().then(setSurveys).catch(() => setSurveys([]));
  }, [router]);

  const loading = ideas === null || surveys === null;

  const validations = (ideas ?? []).reduce((sum, i) => sum + (i._count?.validations ?? 0), 0);
  const responses = (surveys ?? []).reduce((sum, s) => sum + (s._count?.responses ?? 0), 0);
  const liveSurveys = (surveys ?? []).filter((s) => s.status === 'LIVE').length;
  const attention = loading ? [] : computeAttention(ideas!, surveys!);

  const hasAnything = !loading && ((ideas!.length ?? 0) > 0 || (surveys!.length ?? 0) > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <PageHeader
        title={name ? `Welcome back, ${name}` : 'Welcome back'}
        subtitle="Here's where your validation stands."
        actions={
          <Link href="/founder/submit-idea" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            + Submit New Idea
          </Link>
        }
      />

      {loading ? (
        <>
          <SkeletonStatRow />
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <Skeleton className="h-4 w-40 mb-4" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full" />
          </div>
        </>
      ) : !hasAnything ? (
        // First-run: the two clear paths, with enough context to choose.
        <div className="grid sm:grid-cols-2 gap-5">
          <Link href="/founder/submit-idea" className="group bg-white border border-slate-200 shadow-sm rounded-2xl p-7 hover:border-blue-300 hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4">🎯</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1.5">Validate My Idea</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Get structured, expert feedback across 12 scoring frameworks — market opportunity, feasibility, founder fit, and more.
            </p>
            <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">Start expert validation &rarr;</span>
          </Link>
          <Link href="/founder/surveys" className="group bg-white border border-slate-200 shadow-sm rounded-2xl p-7 hover:border-blue-300 hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4">📋</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1.5">Run a Mass Survey</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Build a survey (or let AI draft it), share a link, and collect real responses from your target market.
            </p>
            <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">Create a survey &rarr;</span>
          </Link>
        </div>
      ) : (
        <>
          {/* What's happening */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Ideas" value={ideas!.length} href="/founder/ideas" />
            <StatCard label="Expert validations" value={validations} sub="across all ideas" />
            <StatCard label="Surveys" value={surveys!.length} sub={liveSurveys ? `${liveSurveys} live now` : undefined} href="/founder/surveys" />
            <StatCard label="Survey responses" value={responses} sub="all time" />
          </div>

          {/* What needs my attention */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Needs your attention</h2>
            {attention.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">
                Nothing urgent. Validation is running — check your idea dashboards for new expert feedback and survey results.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {attention.map((a) => (
                  <li key={a.key} className="py-3 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <StatusBadge tone={a.tone} dot className="mt-0.5 shrink-0">
                        {a.tone === 'warning' ? 'Action' : 'FYI'}
                      </StatusBadge>
                      <p className="text-sm text-slate-700 leading-relaxed">{a.text}</p>
                    </div>
                    <Link href={a.href} className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0">
                      {a.cta} &rarr;
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Where to go */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <Link href="/founder/ideas" className="group bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-blue-300 transition flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 text-sm">My Ideas</p>
                <p className="text-xs text-slate-500 mt-0.5">Expert validation dashboards, scores &amp; reports</p>
              </div>
              <span className="text-blue-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
            <Link href="/founder/surveys" className="group bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-blue-300 transition flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 text-sm">My Surveys</p>
                <p className="text-xs text-slate-500 mt-0.5">Build, share &amp; analyze market surveys</p>
              </div>
              <span className="text-blue-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
