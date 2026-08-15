'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge, { type BadgeTone } from '@/components/ui/StatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';

// One derived, human status per idea — the 2-second read the card leads with.
function ideaState(idea: any): { label: string; tone: BadgeTone } {
  if (idea.paymentStatus !== 'COMPLETED') return { label: 'Payment pending', tone: 'warning' };
  const validations = idea._count?.validations ?? 0;
  if (validations === 0) return { label: 'Awaiting experts', tone: 'info' };
  return { label: `${validations} expert validation${validations !== 1 ? 's' : ''}`, tone: 'success' };
}

const STAGE_LABEL: Record<string, string> = {
  IDEA: 'Idea',
  RESEARCH: 'Research',
  PROTOTYPE: 'Prototype',
  MVP: 'MVP',
  REVENUE_GENERATING: 'Revenue generating',
};

export default function FounderIdeasPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [creatingSurveyFor, setCreatingSurveyFor] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getMyIdeas().then(setIdeas).catch(() => setIdeas([]));
  }, [router]);

  const createMassSurvey = async (idea: any) => {
    setCreatingSurveyFor(idea.id);
    try {
      const survey = await api.createSurvey({ ideaId: idea.id, title: `${idea.title} — Survey`, description: '' });
      router.push(`/founder/surveys/${survey.id}/edit`);
    } catch {
      setCreatingSurveyFor(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <PageHeader
        title="My Ideas"
        subtitle="Every idea you've sent to our experts, and how each one is doing"
        actions={
          <Link href="/founder/submit-idea" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            + Submit New Idea
          </Link>
        }
      />

      {ideas === null && <SkeletonList />}

      {ideas !== null && ideas.length === 0 && (
        <EmptyState
          icon="💡"
          title="No ideas yet"
          body="Send us your idea and real industry experts will score it and tell you what's strong, what's weak, and what to fix — before you spend serious time or money building it."
          action={
            <Link href="/founder/submit-idea" className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
              Submit Your First Idea
            </Link>
          }
        />
      )}

      <div className="space-y-4">
        {(ideas ?? []).map((idea) => {
          const isPaid = idea.paymentStatus === 'COMPLETED';
          const state = ideaState(idea);

          return (
            <div key={idea.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 hover:border-slate-300 transition">
              <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900">{idea.title}</h3>
                    {idea.isRevision && <StatusBadge tone="accent">v{idea.version}</StatusBadge>}
                    <StatusBadge tone={state.tone} dot>{state.label}</StatusBadge>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 mb-3">{idea.problemStatement}</p>

                  <div className="flex items-center gap-x-3 gap-y-1 text-xs text-slate-500 flex-wrap">
                    <span>{STAGE_LABEL[idea.stage] || idea.stage}</span>
                    <span className="text-slate-300">·</span>
                    <span>{idea.industryCategory}</span>
                    <span className="text-slate-300">·</span>
                    <span>Submitted {new Date(idea.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* One primary action per card; the survey shortcut stays secondary. */}
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                  {isPaid ? (
                    <Link
                      href={`/founder/ideas/${idea.id}/dashboard`}
                      className="flex-1 sm:flex-none text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-center font-semibold transition"
                    >
                      Open Dashboard
                    </Link>
                  ) : (
                    <Link
                      href={`/founder/submit-idea?pay=${idea.id}`}
                      className="flex-1 sm:flex-none text-sm bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 text-center font-semibold transition"
                    >
                      Complete Payment
                    </Link>
                  )}
                  <button
                    onClick={() => createMassSurvey(idea)}
                    disabled={creatingSurveyFor === idea.id}
                    className="flex-1 sm:flex-none text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-blue-300 hover:text-blue-700 text-center disabled:opacity-60 transition"
                  >
                    {creatingSurveyFor === idea.id ? 'Creating…' : 'Create Survey'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
