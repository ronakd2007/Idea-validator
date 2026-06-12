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

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getMyIdeas().then(setIdeas).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stageColor: Record<string, string> = {
    IDEA: 'bg-gray-100 text-gray-700',
    RESEARCH: 'bg-blue-100 text-blue-700',
    PROTOTYPE: 'bg-yellow-100 text-yellow-700',
    MVP: 'bg-orange-100 text-orange-700',
    REVENUE_GENERATING: 'bg-green-100 text-green-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Ideas</h1>
          <p className="text-gray-500 mt-1">Track all your submitted business ideas</p>
        </div>
        <Link href="/founder/submit-idea"
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition">
          + Submit New Idea
        </Link>
      </div>

      {loading && <div className="text-center py-20 text-gray-400">Loading...</div>}

      {!loading && ideas.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">💡</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No ideas yet</h2>
          <p className="text-gray-500 mb-6">Submit your first business idea to start getting feedback.</p>
          <Link href="/founder/submit-idea" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold">Submit Your First Idea</Link>
        </div>
      )}

      <div className="space-y-4">
        {ideas.map(idea => {
          const isPaid = idea.paymentStatus === 'COMPLETED';

          return (
            <div key={idea.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{idea.title}</h3>
                    {idea.isRevision && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">v{idea.version}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageColor[idea.stage] || 'bg-gray-100 text-gray-600'}`}>{idea.stage.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-500">{idea.industryCategory}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {isPaid ? 'Active' : 'Payment Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{idea.problemStatement}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
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
                      className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-center">
                      View Dashboard
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
