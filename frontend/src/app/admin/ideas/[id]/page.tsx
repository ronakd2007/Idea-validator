'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import RadarChart from '@/components/RadarChart';
import { MATRIX_CATEGORIES, RISK_LABELS, breakdownStatus, dominantRisk, riskTone, TONE_DOM } from '@/lib/reportStatus';
import { downloadValidationReport } from '@/lib/generateValidationReport';
import { CATEGORY_STYLE, SURVEY_STATUS_STYLE, formatDate, formatDateTime, timeAgo } from '@/lib/adminActivity';

const TABS = ['Idea', 'Validations', 'Surveys', 'Activity'];

export default function AdminIdeaDetailPage() {
  const allowed = useAdminGuard();
  const params = useParams();
  const ideaId = String(params?.id || '');

  const [data, setData] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Idea');
  const [downloading, setDownloading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!allowed || !ideaId) return;
    setLoading(true);
    Promise.all([api.getAdminIdeaDashboard(ideaId), api.getAdminIdeaActivity(ideaId)])
      .then(([dash, acts]) => { setData(dash); setActivity(acts); })
      .catch((err: any) => setError(err.message || 'Could not load this idea'))
      .finally(() => setLoading(false));
  }, [allowed, ideaId]);

  // Reuses the founder-facing PDF generator unchanged. The admin gets the same
  // document, built in the browser from data already on this page — there is no
  // second PDF implementation. AI summary is left empty because generating one
  // is a founder action, not something the admin should trigger on their behalf.
  const handleDownloadReport = async () => {
    setDownloading(true);
    setReportError('');
    try {
      await downloadValidationReport({
        idea: data.idea,
        aggregated: data.aggregated,
        aiSummary: '',
        marketResponseLabel: null,
        surveyAnalytics: null,
      });
    } catch (err: any) {
      setReportError(err.message || 'Could not generate the report.');
    } finally {
      setDownloading(false);
    }
  };

  // Admin override for the 48h founder-dashboard gate on this one idea.
  const toggleDashboardUnlock = async () => {
    setUnlocking(true);
    setReportError('');
    try {
      const res = await api.toggleIdeaDashboardUnlock(ideaId);
      setData((prev: any) => ({ ...prev, idea: { ...prev.idea, dashboardUnlockedAt: res.dashboardUnlockedAt } }));
    } catch (err: any) {
      setReportError(err.message || 'Could not change the dashboard lock.');
    } finally {
      setUnlocking(false);
    }
  };

  if (!allowed) return null;
  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center text-slate-500">Loading...</div>;
  if (error) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <Link href="/admin/ideas" className="text-blue-600 hover:text-blue-700">← Back to ideas</Link>
    </div>
  );
  if (!data) return null;

  const { idea, aggregated: a } = data;
  const teamMembers = (() => {
    try { return JSON.parse(idea.teamMembers || '[]'); } catch { return []; }
  })();

  const matrix = MATRIX_CATEGORIES
    .map((c) => ({ ...c, score: (a as any)[c.key] || 0, pct: (((a as any)[c.key] || 0) / 50) * 100 }))
    .filter((c) => c.score > 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/ideas" className="text-slate-500 hover:text-slate-700">← Back</Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{idea.title}</h1>
              {idea.version > 1 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">v{idea.version}</span>}
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                idea.paymentStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>{idea.paymentStatus}</span>
            </div>
            <p className="text-slate-500 mt-1">
              By <Link href={`/admin/users/${idea.founder.id}`} className="text-blue-600 hover:text-blue-700">{idea.founder.name}</Link>
              {' · '}{formatDate(idea.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleDashboardUnlock} disabled={unlocking}
            title="Overrides the 48-hour wait so this founder can see their results now"
            className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 border ${
              idea.dashboardUnlockedAt
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}>
            {unlocking ? 'Saving...' : idea.dashboardUnlockedAt ? '🔓 Dashboard unlocked — restore timer' : '🔓 Unlock dashboard now'}
          </button>
          {a.totalValidations > 0 && (
            <button onClick={handleDownloadReport} disabled={downloading}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {downloading ? 'Generating...' : 'Download validation report'}
            </button>
          )}
        </div>
      </div>

      {reportError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">{reportError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Validations" value={a.totalValidations || 0} />
        <Stat label="Overall score" value={a.overallScore ? `${a.overallScore.toFixed(0)}%` : '—'} />
        <Stat label="Surveys" value={idea.surveys?.length || 0} />
        <Stat label="Survey responses" value={(idea.surveys || []).reduce((s: number, x: any) => s + x._count.responses, 0)} />
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

      {tab === 'Idea' && (
        <div className="space-y-4">
          <Section title="Overview">
            <Field label="Industry" value={idea.industryCategory} />
            <Field label="Stage" value={idea.stage} />
            <Field label="Revenue model" value={idea.revenueModel} />
            <Field label="Target customer" value={idea.targetCustomer} />
            <Field label="Submitted" value={formatDateTime(idea.submittedAt)} />
            {idea.videoUrl && <Field label="Video" value={
              <a href={idea.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 break-all">{idea.videoUrl}</a>
            } />}
          </Section>

          <Section title="Problem">
            <p className="text-slate-700 whitespace-pre-wrap">{idea.problemStatement}</p>
          </Section>
          <Section title="Solution">
            <p className="text-slate-700 whitespace-pre-wrap">{idea.solutionDescription}</p>
          </Section>
          {idea.founderContext && (
            <Section title="Founder context">
              <p className="text-slate-700 whitespace-pre-wrap">{idea.founderContext}</p>
            </Section>
          )}
          {teamMembers.length > 0 && (
            <Section title="Team">
              <ul className="space-y-1 text-sm text-slate-700">
                {teamMembers.map((m: any, i: number) => (
                  <li key={i}>
                    {m.name}
                    {m.linkedinUrl && <> — <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">LinkedIn</a></>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {tab === 'Validations' && (
        <div className="space-y-6">
          {a.totalValidations > 0 ? (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Section title="Score breakdown">
                  <div className="space-y-3">
                    {matrix.map((c) => {
                      const status = breakdownStatus(c.pct);
                      return (
                        <div key={c.key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-700">{c.label}</span>
                            <span className={`font-semibold ${TONE_DOM[status.tone]?.text || 'text-slate-700'}`}>
                              {c.pct.toFixed(0)}% · {status.label}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${TONE_DOM[status.tone]?.bar || 'bg-slate-400'}`} style={{ width: `${c.pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {matrix.length === 0 && <p className="text-sm text-slate-500">No scored categories yet.</p>}
                  </div>
                </Section>

                {matrix.length >= 3 && (
                  <Section title="Score profile">
                    <div className="flex justify-center">
                      <RadarChart data={matrix.map((c) => ({ label: c.short, value: c.pct }))} />
                    </div>
                  </Section>
                )}
              </div>

              {a.riskSummary && Object.keys(a.riskSummary).length > 0 && (
                <Section title="Risk assessment">
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(a.riskSummary).map(([risk, counts]: [string, any]) => {
                      const dom = dominantRisk(counts);
                      const tone = riskTone(dom);
                      return (
                        <div key={risk} className="border border-slate-200 rounded-lg p-3">
                          <div className="text-sm text-slate-700">{RISK_LABELS[risk] || risk}</div>
                          <div className={`text-sm font-semibold mt-1 ${TONE_DOM[tone]?.text || 'text-slate-700'}`}>{dom}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Low {counts.LOW || 0} · Med {counts.MEDIUM || 0} · High {counts.HIGH || 0}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              <div>
                <h2 className="font-semibold text-slate-900 mb-3">Individual validators ({idea.validations.length})</h2>
                <div className="space-y-3">
                  {idea.validations.map((v: any) => (
                    <ValidatorCard key={v.id} v={v} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Empty>No validations have been submitted for this idea yet.</Empty>
          )}
        </div>
      )}

      {tab === 'Surveys' && (
        <div className="space-y-3">
          {(idea.surveys || []).map((s: any) => (
            <Link key={s.id} href={`/admin/surveys/${s.id}`}
              className="block bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-blue-300 transition">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SURVEY_STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-700'}`}>
                    {s.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div className="font-semibold text-slate-700">{s._count.responses} responses</div>
                  <div>{formatDate(s.createdAt)}</div>
                </div>
              </div>
            </Link>
          ))}
          {(!idea.surveys || idea.surveys.length === 0) && <Empty>No surveys are attached to this idea.</Empty>}
        </div>
      )}

      {tab === 'Activity' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">User</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Activity</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">When</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((act) => (
                <tr key={act.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4">
                    {act.userId
                      ? <Link href={`/admin/users/${act.userId}`} className="text-blue-600 hover:text-blue-700">{act.actorLabel}</Link>
                      : <span className="text-slate-500">{act.actorLabel}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900">{act.actionLabel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[act.category] || 'bg-slate-100 text-slate-700'}`}>
                        {act.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap" title={formatDateTime(act.createdAt)}>
                    {timeAgo(act.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activity.length === 0 && <Empty>No recorded activity for this idea yet.</Empty>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
      <h2 className="font-semibold text-slate-900 mb-4">{title}</h2>
      {children}
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

// One validator's full submission: who they are, every score group they filled
// in, and their written feedback.
function ValidatorCard({ v }: { v: any }) {
  const [open, setOpen] = useState(false);

  const groups: { label: string; data: any }[] = [
    { label: 'Market opportunity', data: v.marketOpportunity },
    { label: 'Feasibility', data: v.feasibility },
    { label: 'Founder fit', data: v.founderFit },
    { label: 'Revenue potential', data: v.revenuePotential },
    { label: 'Scalability', data: v.scalability },
    { label: 'Investor attractiveness', data: v.investorAttractiveness },
    { label: 'Innovation', data: v.innovation },
    { label: 'Social impact', data: v.socialImpact },
    { label: 'Shark Tank', data: v.sharkTank },
    { label: 'Startup success', data: v.startupSuccess },
  ].filter((g) => g.data);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/admin/users/${v.validator.id}`} className="font-semibold text-blue-600 hover:text-blue-700">
            {v.validator.name}
          </Link>
          <p className="text-sm text-slate-500 mt-0.5">
            {v.validator.validatorProfile?.occupation || 'Validator'}
            {v.validator.validatorProfile?.yearsOfExperience != null && ` · ${v.validator.validatorProfile.yearsOfExperience} yrs`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{formatDate(v.createdAt)}</span>
          <button onClick={() => setOpen((o) => !o)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            {open ? 'Hide scores' : 'View scores'}
          </button>
        </div>
      </div>

      {v.openFeedback && (
        <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
          <FeedbackBox label="Biggest strength" value={v.openFeedback.biggestStrength} />
          <FeedbackBox label="Biggest weakness" value={v.openFeedback.biggestWeakness} />
          <FeedbackBox label="Suggested improvement" value={v.openFeedback.suggestedImprovement} />
        </div>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <h4 className="text-xs uppercase tracking-wide text-slate-400 mb-2">{g.label}</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(g.data)
                  .filter(([k]) => !['id', 'validationResponseId'].includes(k))
                  .map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-2 bg-slate-50 rounded px-3 py-1.5">
                      <span className="text-slate-500">{humanize(k)}</span>
                      <span className="font-medium text-slate-900">{String(val)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {v.customerValidation && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Customer validation</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(v.customerValidation)
                  .filter(([k]) => !['id', 'validationResponseId'].includes(k))
                  .map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-2 bg-slate-50 rounded px-3 py-1.5">
                      <span className="text-slate-500">{humanize(k)}</span>
                      <span className={`font-medium ${val ? 'text-emerald-700' : 'text-slate-500'}`}>{val ? 'Yes' : 'No'}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {v.riskAssessment && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Risk assessment</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(v.riskAssessment)
                  .filter(([k]) => !['id', 'validationResponseId'].includes(k))
                  .map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-2 bg-slate-50 rounded px-3 py-1.5">
                      <span className="text-slate-500">{humanize(k)}</span>
                      <span className="font-medium text-slate-900">{String(val)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-slate-700 whitespace-pre-wrap">{value || '—'}</div>
    </div>
  );
}

function humanize(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}
