'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export default function FounderIdeasPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSurveyFor, setCreatingSurveyFor] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getMyIdeas().then(setIdeas).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const createMassSurvey = async (idea: any) => {
    setCreatingSurveyFor(idea.id);
    try {
      const survey = await api.createSurvey({ ideaId: idea.id, title: `${idea.title} — Survey`, description: '' });
      router.push(`/founder/surveys/${survey.id}/edit`);
    } catch {
      setCreatingSurveyFor(null);
    }
  };

  const stageColor: Record<string, string> = {
    IDEA: 'bg-slate-100 text-slate-700',
    RESEARCH: 'bg-blue-50 text-blue-700',
    PROTOTYPE: 'bg-amber-50 text-amber-700',
    MVP: 'bg-orange-50 text-orange-700',
    REVENUE_GENERATING: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Ideas</h1>
          <p className="text-slate-500 mt-1">Track all your submitted business ideas</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/founder/surveys"
            className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-semibold hover:border-slate-300 transition">
            My Surveys
          </Link>
          <Link href="/founder/submit-idea"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
            + Submit New Idea
          </Link>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      {!loading && ideas.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">💡</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No ideas yet</h2>
          <p className="text-slate-500 mb-6">Submit your first business idea to start getting feedback.</p>
          <Link href="/founder/submit-idea" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold">Submit Your First Idea</Link>
        </div>
      )}

      <div className="space-y-4">
        {ideas.map(idea => {
          const isPaid = idea.paymentStatus === 'COMPLETED';

          return (
            <div key={idea.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{idea.title}</h3>
                    {idea.isRevision && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">v{idea.version}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageColor[idea.stage] || 'bg-slate-100 text-slate-700'}`}>{idea.stage.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-500">{idea.industryCategory}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {isPaid ? 'Active' : 'Payment Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{idea.problemStatement}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span>{idea._count.validations} validation{idea._count.validations !== 1 ? 's' : ''}</span>
                    <span>Submitted {new Date(idea.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="ml-4 flex flex-col gap-2">
                  {!isPaid && (
                    <Link href={`/founder/submit-idea?pay=${idea.id}`}
                      className="text-sm bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 text-center">
                      Complete Payment
                    </Link>
                  )}
                  {isPaid && (
                    <Link href={`/founder/ideas/${idea.id}/dashboard`}
                      className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-center">
                      Expert Validation
                    </Link>
                  )}
                  <button
                    onClick={() => createMassSurvey(idea)}
                    disabled={creatingSurveyFor === idea.id}
                    className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:border-blue-300 hover:text-blue-700 text-center disabled:opacity-60"
                  >
                    {creatingSurveyFor === idea.id ? 'Creating...' : 'Create Mass Survey'}
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
