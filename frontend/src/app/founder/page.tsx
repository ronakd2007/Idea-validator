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
import WelcomeModal from '@/components/founder/WelcomeModal';

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
        text: `"${idea.title}" is waiting on payment — experts haven't started reviewing it yet.`,
        href: `/founder/submit-idea?pay=${idea.id}`,
        cta: 'Complete payment',
      });
    } else if ((idea._count?.validations ?? 0) === 0) {
      items.push({
        key: `noval-${idea.id}`,
        tone: 'info',
        text: `"${idea.title}" is with our experts. Nothing to do — you'll see scores here as reviews come in.`,
        href: `/founder/ideas/${idea.id}/dashboard`,
        cta: 'Open it',
      });
    }
  }

  for (const s of surveys) {
    const responses = s._count?.responses ?? 0;
    if (s.status === 'DRAFT') {
      items.push({
        key: `draft-${s.id}`,
        tone: 'warning',
        text: `Your survey "${s.title}" isn't published yet — nobody can answer it until you publish.`,
        href: `/founder/surveys/${s.id}/edit`,
        cta: 'Finish & publish',
      });
    } else if (s.status === 'LIVE' && responses === 0) {
      items.push({
        key: `noresp-${s.id}`,
        tone: 'info',
        text: `"${s.title}" is live but nobody has answered yet — share the link with people who'd use your product.`,
        href: `/founder/surveys`,
        cta: 'Get the link',
      });
    } else if (s.status === 'LIVE' && s.responseLimit != null && responses >= s.responseLimit) {
      items.push({
        key: `limit-${s.id}`,
        tone: 'warning',
        text: `"${s.title}" reached its limit of ${s.responseLimit} answers — close it or raise the limit.`,
        href: `/founder/surveys/${s.id}/analytics`,
        cta: 'See results',
      });
    }
  }

  return items.slice(0, 5);
}

function Step({ n, done, title, body, href, cta, active }: {
  n: number; done: boolean; title: string; body: string; href: string; cta: string; active: boolean;
}) {
  return (
    <div className={`flex items-start gap-3.5 py-4 ${!active && !done ? 'opacity-55' : ''}`}>
      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
      }`}>
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{title}</p>
        {!done && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{body}</p>}
      </div>
      {!done && active && (
        <Link href={href} className="shrink-0 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition whitespace-nowrap">
          {cta}
        </Link>
      )}
    </div>
  );
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

  // The four steps of the core loop. A founder is "getting started" until
  // they've been all the way round it once — after that the checklist is
  // replaced by the metrics view, which is more useful to a returning user.
  const hasIdea = (ideas?.length ?? 0) > 0;
  const hasExpertFeedback = validations > 0;
  const hasSurvey = (surveys?.length ?? 0) > 0;
  const hasAnswers = responses > 0;
  const loopComplete = hasIdea && hasExpertFeedback && hasSurvey && hasAnswers;
  const firstIdeaId = ideas?.[0]?.id;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <WelcomeModal />

      <PageHeader
        title={name ? `Welcome, ${name}` : 'Welcome'}
        subtitle={loopComplete ? "Here's where your validation stands." : "Let's find out if your idea is worth building."}
        actions={
          loopComplete ? (
            <Link href="/founder/submit-idea" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
              + Submit New Idea
            </Link>
          ) : undefined
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
      ) : !loopComplete ? (
        <>
          {/* Getting started: the whole product as four plain steps, with
              exactly one highlighted action at any moment. */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900">How this works</h2>
            <p className="text-sm text-slate-500 mt-0.5 mb-2">Four steps. You can stop after any of them.</p>
            <div className="divide-y divide-slate-100">
              <Step
                n={1} done={hasIdea} active={!hasIdea}
                title="Describe your idea"
                body="A few short questions about the problem you're solving and who it's for. Takes about 10 minutes."
                href="/founder/submit-idea" cta="Start"
              />
              <Step
                n={2} done={hasExpertFeedback} active={hasIdea && !hasExpertFeedback}
                title="Get expert feedback"
                body="Real industry experts score your idea and write honest comments. This happens on its own once you've submitted — no action needed while you wait."
                href={firstIdeaId ? `/founder/ideas/${firstIdeaId}/dashboard` : '/founder/ideas'} cta="Check status"
              />
              <Step
                n={3} done={hasAnswers} active={hasIdea && !hasAnswers}
                title="Ask real customers"
                body={hasSurvey
                  ? "Your survey is ready — now share the link with people who might use your product."
                  : "Create a short survey (our AI can write it for you) and send the link to people who might use your product. This is free."}
                href="/founder/surveys" cta={hasSurvey ? 'Share it' : 'Create survey'}
              />
              <Step
                n={4} done={loopComplete} active={hasExpertFeedback || hasAnswers}
                title="Read your results"
                body="See what's strong, what's weak, and what to do next — in plain English."
                href={firstIdeaId ? `/founder/ideas/${firstIdeaId}/dashboard` : '/founder/surveys'} cta="See results"
              />
            </div>
          </div>

          {/* Reassurance for the hesitant: show the outcome before they pay. */}
          {!hasIdea && (
            <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-900">Not sure what you&apos;ll get?</p>
                <p className="text-xs text-blue-800/80 mt-0.5">Look at a finished report for an example idea — no signup, no payment, nothing to fill in.</p>
              </div>
              <Link href="/founder/sample-report" className="shrink-0 text-sm bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-semibold hover:bg-blue-100/50 transition">
                See an example report
              </Link>
            </div>
          )}

          {attention.length > 0 && (
            <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-900 mb-1">Needs your attention</h2>
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
            </div>
          )}
        </>
      ) : (
        <>
          {/* What's happening */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Ideas" value={ideas!.length} href="/founder/ideas" />
            <StatCard label="Expert reviews" value={validations} sub="across all ideas" />
            <StatCard label="Surveys" value={surveys!.length} sub={liveSurveys ? `${liveSurveys} collecting answers now` : undefined} href="/founder/surveys" />
            <StatCard label="People who answered" value={responses} sub="all time" />
          </div>

          {/* What needs my attention */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Needs your attention</h2>
            {attention.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">
                Nothing urgent right now. Open an idea to read your latest expert feedback and survey results.
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
                <p className="text-xs text-slate-500 mt-0.5">Expert scores, comments &amp; your full report</p>
              </div>
              <span className="text-blue-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
            <Link href="/founder/surveys" className="group bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-blue-300 transition flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 text-sm">Customer Surveys</p>
                <p className="text-xs text-slate-500 mt-0.5">Write, share &amp; read answers from real people</p>
              </div>
              <span className="text-blue-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
