'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ROLE_STYLE, CATEGORY_STYLE, formatDateTime } from '@/lib/adminActivity';

// Slide-over shown when the admin clicks a row in the activity feed. Loads the
// activity plus the current state of whatever it acted on, so the admin can go
// straight from "this happened" to the actual data.
export default function ActivityDetailPanel({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getAdminActivityDetail(activityId)
      .then(setDetail)
      .catch((err: any) => setError(err.message || 'Could not load this activity'))
      .finally(() => setLoading(false));
  }, [activityId]);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Activity detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4">
          {loading && <div className="text-center py-16 text-slate-500">Loading...</div>}
          {error && !loading && <div className="text-center py-16 text-red-600 text-sm">{error}</div>}

          {detail && !loading && (
            <>
              <Row label="User">
                {detail.actor ? (
                  <Link href={detail.actor.href} className="text-blue-600 hover:text-blue-700 font-medium">
                    {detail.actor.name}
                  </Link>
                ) : (
                  <span className="text-slate-500">{detail.actorLabel}</span>
                )}
                {detail.actorEmail && <div className="text-xs text-slate-500 mt-0.5">{detail.actorEmail}</div>}
              </Row>

              <Row label="Role">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_STYLE[detail.actorRole] || 'bg-slate-100 text-slate-700'}`}>
                  {detail.actorRole}
                </span>
              </Row>

              <Row label="Activity">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{detail.actionLabel}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[detail.category] || 'bg-slate-100 text-slate-700'}`}>
                    {detail.category}
                  </span>
                </div>
              </Row>

              <Row label="Time">{formatDateTime(detail.createdAt)}</Row>

              <Row label="Target">
                {detail.target ? (
                  <Link href={detail.target.href} className="text-blue-600 hover:text-blue-700 font-medium">
                    {detail.target.title}
                  </Link>
                ) : detail.targetLabel ? (
                  <span>
                    {detail.targetLabel}
                    <span className="block text-xs text-slate-400 mt-0.5">No longer available</span>
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Row>

              {detail.target && (
                <div className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Relevant information</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    <Detail label="ID" value={detail.target.id} mono />
                    {detail.target.status && <Detail label="Status" value={detail.target.status} />}
                    {detail.target.responseCount != null && <Detail label="Responses" value={detail.target.responseCount} />}
                    {detail.target.questionCount != null && <Detail label="Questions" value={detail.target.questionCount} />}
                    {detail.target.validationCount != null && <Detail label="Validations" value={detail.target.validationCount} />}
                    {detail.target.surveyCount != null && <Detail label="Surveys" value={detail.target.surveyCount} />}
                    {detail.target.versionNumber != null && <Detail label="Version" value={`v${detail.target.versionNumber}`} />}
                    {detail.target.industryCategory && <Detail label="Industry" value={detail.target.industryCategory} />}
                    {detail.target.stage && <Detail label="Stage" value={detail.target.stage} />}
                    {detail.target.creator && <Detail label="Created by" value={detail.target.creator.name} />}
                    {detail.target.validator && <Detail label="Validator" value={detail.target.validator.name} />}
                    {detail.target.createdAt && <Detail label="Created" value={formatDateTime(detail.target.createdAt)} />}
                  </div>
                </div>
              )}

              {Object.keys(detail.metadata || {}).length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Recorded with this activity</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    {Object.entries(detail.metadata).map(([k, v]) => (
                      <Detail key={k} label={k} value={String(v)} mono={k.toLowerCase().includes('id')} />
                    ))}
                  </div>
                </div>
              )}

              {detail.actorRole === 'RESPONDENT' && (
                <p className="mt-5 text-xs text-slate-500 bg-violet-50 border border-violet-100 rounded-lg p-3">
                  Survey respondents are anonymous by design. This record is not linked to any account
                  or to a specific set of answers.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-900 text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
