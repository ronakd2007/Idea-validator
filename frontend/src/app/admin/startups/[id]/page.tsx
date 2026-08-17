'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import { useToast, useConfirm } from '@/components/ui/feedback';
import { lookingForLabel, stageLabel } from '@/lib/startupTypes';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-blue-50 text-blue-700',
  CHANGES_REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-slate-800 whitespace-pre-line break-words">{children || <span className="text-slate-300">—</span>}</div>
    </div>
  );
}

export default function AdminStartupDetailPage() {
  const allowed = useAdminGuard();
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');
  const toast = useToast();
  const confirm = useConfirm();

  const [s, setS] = useState<any>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!allowed || !id) return;
    api.getAdminStartup(id)
      .then((res: any) => { setS(res); setNote(res.adminNote || ''); setMessage(res.reviewMessage || ''); })
      .catch((err: any) => setError(err.message || 'Could not load this startup'));
  }, [allowed, id]);

  if (!allowed) return null;
  if (error) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <Link href="/admin/startups" className="text-blue-600 hover:text-blue-700">← Back to startups</Link>
    </div>
  );
  if (!s) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center text-slate-500">Loading…</div>;

  const act = async (action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT') => {
    const copy = {
      APPROVE: { title: `Publish ${s.name}?`, body: 'The startup becomes visible in the public directory immediately.', cta: 'Approve & Publish', danger: false },
      REQUEST_CHANGES: { title: 'Request changes?', body: 'The founder will see your message and can edit and resubmit.', cta: 'Send Request', danger: false },
      REJECT: { title: `Reject ${s.name}?`, body: 'The listing will not be published and the founder can no longer edit it.', cta: 'Reject Listing', danger: true },
    }[action];

    if (action === 'REQUEST_CHANGES' && !message.trim()) {
      toast.error('Write a message telling the founder what to change.');
      return;
    }
    const ok = await confirm({ title: copy.title, body: copy.body, confirmLabel: copy.cta, danger: copy.danger });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await api.reviewStartup(id, { action, reviewMessage: message.trim(), adminNote: note.trim() });
      toast.success(
        action === 'APPROVE' ? 'Startup published to the directory.'
        : action === 'REJECT' ? 'Listing rejected.'
        : 'Changes requested — the founder has been notified in their dashboard.'
      );
      setS({ ...s, status: res.status, slug: res.slug });
      if (action !== 'REQUEST_CHANGES') router.push('/admin/startups');
    } catch (err: any) {
      toast.error(err.message || 'Could not complete that action.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/admin/startups" className="text-sm text-slate-500 hover:text-slate-700">← Back to startups</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mt-4 mb-6">
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : <span className="text-xl text-slate-300">🏢</span>}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{s.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              by <Link href={`/admin/users/${s.founder?.id}`} className="text-blue-600 hover:text-blue-700">{s.founder?.name}</Link>
              {' · '}{s.founder?.email}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[s.status]}`}>{s.status.replace('_', ' ')}</span>
      </div>

      {/* Validation context for the reviewer */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Underlying validation</p>
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {s.validation?.score ?? '—'}{s.validation?.score != null && <span className="text-xs text-slate-400">/100</span>}
            </p>
            <p className="text-xs text-slate-500">Validation score</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{s.validation?.validatorCount ?? 0}</p>
            <p className="text-xs text-slate-500">Expert reviewers</p>
          </div>
          <div className="min-w-0">
            <Link href={`/admin/ideas/${s.idea?.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View the original idea →
            </Link>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{s.idea?.title}</p>
          </div>
        </div>
      </div>

      {/* Submitted content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">Submitted profile</h2>
        <Field label="One-line description">{s.tagline}</Field>
        <Field label="About">{s.about}</Field>
        <Field label="Problem">{s.problem}</Field>
        <Field label="Solution">{s.solution}</Field>
        <Field label="Product">{s.product}</Field>
        <Field label="Traction">{s.traction}</Field>
        <Field label="Industry · Location · Stage">
          {[s.industry, s.location, s.stage ? stageLabel(s.stage) : ''].filter(Boolean).join(' · ')}
        </Field>
        <Field label="Founded">{s.foundedYear ? String(s.foundedYear) : ''}</Field>
        <Field label="Website">{s.website ? <a href={s.website} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline break-all">{s.website}</a> : ''}</Field>
        <Field label="LinkedIn">{s.linkedinUrl ? <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline break-all">{s.linkedinUrl}</a> : ''}</Field>
        <Field label="Team">
          {s.teamMembers?.length ? s.teamMembers.map((m: any) => m.name).join(', ') : ''}
        </Field>
        <Field label="Looking for">
          {s.lookingFor?.length ? s.lookingFor.map(lookingForLabel).join(' · ') : ''}
        </Field>
        <Field label="Chose to publish">
          {[
            s.validationDisplay?.showScore && 'validation score',
            s.validationDisplay?.showValidatorCount && 'reviewer count',
            s.validationDisplay?.showCustomerValidation && 'customer validation',
          ].filter(Boolean).join(', ') || 'nothing from their validation'}
        </Field>
      </div>

      {/* Review */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Review</h2>

        <label className="block text-sm font-medium text-slate-700 mb-1">Message to founder</label>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Required when requesting changes — tell them exactly what to fix."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 resize-none mb-4" />

        <label className="block text-sm font-medium text-slate-700 mb-1">
          Private admin note <span className="text-slate-400 font-normal">— never shown to the founder</span>
        </label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 resize-none mb-5" />

        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => act('REJECT')} disabled={busy}
            className="text-sm bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-50 disabled:opacity-60">
            Reject
          </button>
          <button onClick={() => act('REQUEST_CHANGES')} disabled={busy}
            className="text-sm bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-lg font-semibold hover:bg-amber-50 disabled:opacity-60">
            Request Changes
          </button>
          <button onClick={() => act('APPROVE')} disabled={busy}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
            Approve &amp; Publish
          </button>
        </div>
      </div>
    </div>
  );
}
