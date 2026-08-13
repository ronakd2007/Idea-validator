'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import { setViewContext } from '@/lib/auth';
import {
  ROLE_STYLE, CATEGORY_STYLE, SURVEY_STATUS_STYLE, formatDate, formatDateTime, timeAgo, targetHref,
} from '@/lib/adminActivity';

const TABS = ['Profile', 'Ideas', 'Surveys', 'Validations', 'Activity'];

export default function AdminUserDetailPage() {
  const allowed = useAdminGuard();
  const params = useParams();
  const router = useRouter();
  const userId = String(params?.id || '');

  const [data, setData] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Profile');
  const [startingView, setStartingView] = useState(false);

  useEffect(() => {
    if (!allowed || !userId) return;
    setLoading(true);
    Promise.all([api.getAdminUserOverview(userId), api.getAdminUserActivity(userId, 200)])
      .then(([overview, acts]) => { setData(overview); setActivity(acts); })
      .catch((err: any) => setError(err.message || 'Could not load this user'))
      .finally(() => setLoading(false));
  }, [allowed, userId]);

  if (!allowed) return null;

  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center text-slate-500">Loading...</div>;
  if (error) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <Link href="/admin/users" className="text-blue-600 hover:text-blue-700">← Back to users</Link>
    </div>
  );
  if (!data) return null;

  const { user, stats, ideas, surveys, validationsGiven, validationsReceived } = data;
  const isValidator = user.role === 'VALIDATOR';

  const statCards = [
    { label: 'Ideas', value: stats.ideas },
    { label: 'Surveys', value: stats.surveys },
    { label: 'Responses received', value: stats.responsesReceived },
    { label: isValidator ? 'Validations given' : 'Validations received', value: isValidator ? stats.validationsGiven : stats.validationsReceived },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/users" className="text-slate-500 hover:text-slate-700">← Back</Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{user.name}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_STYLE[user.role] || 'bg-slate-100 text-slate-700'}`}>
                {user.role}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-slate-500 mt-1">Account created {formatDate(user.createdAt)}</p>
          </div>
        </div>
        {user.role !== 'ADMIN' && (
          <button
            onClick={async () => {
              const ok = window.confirm(
                `View this account as ${user.name}?\n\nYou will temporarily view the platform from this user's perspective. Your admin session will remain active.`
              );
              if (!ok) return;
              setStartingView(true);
              try {
                const res = await api.startViewAs(user.id);
                setViewContext({ token: res.viewToken, expiresAt: res.expiresAt, target: res.target });
                router.push(res.target.role === 'VALIDATOR' ? '/validator/dashboard' : '/founder');
              } catch (err: any) {
                alert(err.message);
                setStartingView(false);
              }
            }}
            disabled={startingView}
            className="bg-amber-500 text-amber-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-400 disabled:opacity-50 shadow-sm"
          >
            {startingView ? 'Starting…' : '👁 View as User'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
            <div className="text-2xl font-black text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Profile' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 max-w-2xl">
          <Field label="Name" value={user.name} />
          <Field label="Email" value={user.email} />
          <Field label="Role" value={user.role} />
          <Field label="Phone" value={user.phone ? `${user.phone}${user.phoneVerified ? ' (verified)' : ''}` : '—'} />
          <Field label="Sign-in method" value={user.googleId ? 'Google' : 'Email and password'} />
          <Field label="Account created" value={formatDateTime(user.createdAt)} />
          <Field label="Status" value={user.isActive ? 'Active' : 'Deactivated'} />

          {user.validatorProfile && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">Validator profile</h3>
              <Field label="Occupation" value={user.validatorProfile.occupation} />
              <Field label="Experience" value={`${user.validatorProfile.yearsOfExperience} years`} />
              <Field label="Expertise" value={user.validatorProfile.areasOfExpertise?.split(',').join(', ')} />
              <Field label="LinkedIn" value={
                <a href={user.validatorProfile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 break-all">{user.validatorProfile.linkedinUrl}</a>
              } />
              <Field label="Approved" value={user.validatorProfile.isApproved
                ? `Yes, ${formatDate(user.validatorProfile.approvedAt)}` : 'Pending approval'} />
            </div>
          )}
        </div>
      )}

      {tab === 'Ideas' && (
        <div className="space-y-3">
          {ideas.map((i: any) => (
            <Link key={i.id} href={`/admin/ideas/${i.id}`}
              className="block bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-blue-300 transition">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{i.title}</h3>
                    {i.version > 1 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">v{i.version}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      i.paymentStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>{i.paymentStatus}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{i.industryCategory} · {i.stage}</p>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div>{i._count.validations} validations</div>
                  <div>{i._count.surveys} surveys</div>
                  <div className="mt-1">{formatDate(i.createdAt)}</div>
                </div>
              </div>
            </Link>
          ))}
          {ideas.length === 0 && <Empty>This user has not submitted any ideas.</Empty>}
        </div>
      )}

      {tab === 'Surveys' && (
        <div className="space-y-3">
          {surveys.map((s: any) => (
            <Link key={s.id} href={`/admin/surveys/${s.id}`}
              className="block bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-blue-300 transition">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SURVEY_STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-700'}`}>
                      {s.status}
                    </span>
                    {s.versionNumber > 1 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">v{s.versionNumber}</span>}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.idea?.title || 'Standalone survey'}</p>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div>{s._count.questions} questions</div>
                  <div className="font-semibold text-slate-700">{s._count.responses} responses</div>
                  <div className="mt-1">{formatDate(s.createdAt)}</div>
                </div>
              </div>
            </Link>
          ))}
          {surveys.length === 0 && <Empty>This user has not created any surveys.</Empty>}
        </div>
      )}

      {tab === 'Validations' && (
        <div className="space-y-3">
          {isValidator ? (
            <>
              <p className="text-sm text-slate-500 mb-2">Validations this validator submitted.</p>
              {validationsGiven.map((v: any) => (
                <ValidationCard key={v.id} v={v} ideaTitle={v.idea.title} ideaId={v.idea.id}
                  counterparty={`Founder: ${v.idea.founder?.name || '—'}`} />
              ))}
              {validationsGiven.length === 0 && <Empty>This validator has not submitted any validations.</Empty>}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-2">Validations received on this founder&apos;s ideas.</p>
              {validationsReceived.map((v: any) => (
                <ValidationCard key={v.id} v={v} ideaTitle={v.idea.title} ideaId={v.idea.id}
                  counterparty={`Validator: ${v.validator?.name || '—'}`} />
              ))}
              {validationsReceived.length === 0 && <Empty>No validations have been submitted on this founder&apos;s ideas yet.</Empty>}
            </>
          )}
        </div>
      )}

      {tab === 'Activity' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Activity</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Target</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">When</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => {
                const href = targetHref(a);
                return (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-900">{a.actionLabel}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[a.category] || 'bg-slate-100 text-slate-700'}`}>
                          {a.category}
                        </span>
                        {/* Activity on something they own, performed by someone else. */}
                        {!a.isOwnAction && (
                          <span className="text-xs text-slate-500 italic">by {a.actorLabel}</span>
                        )}
                      </div>
                    </td>
                    {/* truncate needs a block box — a <td> ignores it */}
                    <td className="px-6 py-4 text-slate-600">
                      <div className="max-w-[260px] truncate">
                        {href ? <Link href={href} className="text-blue-600 hover:text-blue-700">{a.targetLabel || '—'}</Link> : (a.targetLabel || '—')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap" title={formatDateTime(a.createdAt)}>
                      {timeAgo(a.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {activity.length === 0 && <Empty>No recorded activity for this user yet.</Empty>}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0 flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-900 text-right">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-14 text-slate-500">{children}</div>;
}

function ValidationCard({ v, ideaTitle, ideaId, counterparty }: { v: any; ideaTitle: string; ideaId: string; counterparty: string }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <Link href={`/admin/ideas/${ideaId}`} className="font-semibold text-blue-600 hover:text-blue-700">{ideaTitle}</Link>
          <p className="text-sm text-slate-500 mt-0.5">{counterparty}</p>
        </div>
        <span className="text-xs text-slate-500">{formatDate(v.createdAt)}</span>
      </div>
      {v.openFeedback && (
        <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
          <Feedback label="Biggest strength" value={v.openFeedback.biggestStrength} />
          <Feedback label="Biggest weakness" value={v.openFeedback.biggestWeakness} />
          <Feedback label="Suggested improvement" value={v.openFeedback.suggestedImprovement} />
        </div>
      )}
    </div>
  );
}

function Feedback({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-slate-700">{value || '—'}</div>
    </div>
  );
}
