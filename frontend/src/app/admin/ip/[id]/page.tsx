'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/feedback';
import {
  ipTypeLabel, ipStatusLabel, ipStatusTone, ipReviewMeta, IP_STATUS_SOURCE_NOTE, IP_DISCLAIMER,
} from '@/lib/ipTypes';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 w-44 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-800 min-w-0 break-words">{children || '—'}</dd>
    </div>
  );
}

/**
 * Admin review of one IP record.
 *
 * This is the second of the two locks. The founder has already asked for the
 * record to be public; approving here is what actually puts it on the registry.
 * The page shows everything, including the fields the founder chose to keep
 * private, so the decision is made on the full picture.
 */
export default function AdminIpRecordPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const allowed = useAdminGuard();
  const toast = useToast();

  const [record, setRecord] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const res = await api.getAdminIpRecord(id);
      setRecord(res);
      setAdminNote(res.adminNote ?? '');
      setReviewMessage(res.reviewMessage ?? '');
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, id]);

  const act = async (action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') => {
    if (action === 'REQUEST_CHANGES' && !reviewMessage.trim()) {
      toast.error('Tell the founder what needs changing.');
      return;
    }
    setBusy(action);
    try {
      const res = await api.reviewIpRecord(id, { action, reviewMessage, adminNote });
      toast.success(
        res.isLive
          ? 'Approved — it is live on the public registry now.'
          : action === 'APPROVE'
            ? 'Approved. It will go live when the founder makes it public.'
            : action === 'REJECT'
              ? 'Rejected. The record stays private to the founder.'
              : 'Changes requested.'
      );
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not save that decision.');
    } finally {
      setBusy('');
    }
  };

  if (!allowed) return null;

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-800">Record not found</h1>
        <Link href="/admin/ip" className="text-blue-700 hover:underline text-sm mt-4 inline-block">
          Back to IP &amp; Patents
        </Link>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <SkeletonCard />
      </div>
    );
  }

  const review = ipReviewMeta(record.reviewStatus);
  const wantsPublic = record.visibility === 'PUBLIC';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/admin/ip" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to IP &amp; Patents
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mt-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{record.title}</h1>
          <p className="text-slate-500 mt-1">
            {record.founder?.name} · {record.founder?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={ipStatusTone(record.status)}>{ipStatusLabel(record.status)}</StatusBadge>
          <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
        </div>
      </div>

      {/* Says plainly what approving would actually do right now. */}
      <div
        className={`rounded-xl border px-4 py-3 mb-6 text-sm ${
          wantsPublic ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {wantsPublic
          ? 'The founder has asked for this to appear on the public registry. Approving publishes it.'
          : 'The founder has this set to private, so approving will not publish anything until they make it public.'}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">The record</h2>
        <dl>
          <Row label="Type">{ipTypeLabel(record.type)}</Row>
          <Row label="Status">
            {ipStatusLabel(record.status)}{' '}
            <span className="text-slate-400">— {IP_STATUS_SOURCE_NOTE.toLowerCase()}</span>
          </Row>
          <Row label="Description">{record.description}</Row>
          <Row label="Application number">{record.applicationNumber}</Row>
          <Row label="Filing date">
            {record.filingDate ? new Date(record.filingDate).toLocaleDateString() : ''}
          </Row>
          <Row label="Jurisdiction">{record.jurisdiction}</Row>
          <Row label="Authority">{record.authority}</Row>
          <Row label="Inventor(s)">{(record.inventorNames ?? []).join(', ')}</Row>
          <Row label="Owner">{record.ownerName}</Row>
          <Row label="Location">{[record.city, record.state].filter(Boolean).join(', ')}</Row>
          <Row label="Institution">{record.institution}</Row>
          <Row label="Linked idea">{record.idea?.title}</Row>
          <Row label="Startup">{record.idea?.startup?.name}</Row>
          <Row label="Patent office link">
            {record.publicUrl && (
              <a
                href={record.publicUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-blue-700 hover:underline break-all"
              >
                {record.publicUrl} ↗
              </a>
            )}
          </Row>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Private to the founder</h2>
        <p className="text-xs text-slate-400 mb-3">
          None of this is ever shown on the public registry, whatever the founder opted into.
        </p>
        <dl>
          <Row label="Notes">{record.notes}</Row>
          <Row label="Documents">
            {record.documents?.length ? (
              <ul className="space-y-1">
                {record.documents.map((d: any) => (
                  <li key={d.id}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      📄 {d.fileName}
                    </a>
                    <span className="text-xs text-slate-400 ml-2">{d.documentType}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Row>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">What the founder chose to publish</h2>
        <p className="text-xs text-slate-400 mb-3">
          Always shown: title, type, description, status, country, filing year, city and state.
        </p>
        <ul className="text-sm text-slate-700 space-y-1">
          {Object.entries(record.publicFields ?? {}).map(([key, on]) => (
            <li key={key}>
              <span className={on ? 'text-emerald-700' : 'text-slate-400'}>{on ? '✓' : '✕'}</span>{' '}
              <span className={on ? '' : 'text-slate-400'}>
                {key.replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Your decision</h2>

        <label className="block text-sm font-medium text-slate-700 mb-1">
          Message to the founder
          <span className="text-slate-400 font-normal"> — required to request changes</span>
        </label>
        <textarea
          rows={3}
          value={reviewMessage}
          onChange={(e) => setReviewMessage(e.target.value)}
          maxLength={1000}
          placeholder="e.g. Please remove the client name from the description before we publish this."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">
          Private admin note <span className="text-slate-400 font-normal">— the founder never sees this</span>
        </label>
        <textarea
          rows={2}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          maxLength={2000}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => act('APPROVE')}
            disabled={!!busy}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {busy === 'APPROVE' ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={() => act('REQUEST_CHANGES')}
            disabled={!!busy}
            className="bg-white border border-amber-300 text-amber-700 px-5 py-2.5 rounded-lg font-medium hover:bg-amber-50 transition disabled:opacity-60"
          >
            {busy === 'REQUEST_CHANGES' ? 'Sending…' : 'Request changes'}
          </button>
          <button
            onClick={() => act('REJECT')}
            disabled={!!busy}
            className="bg-white border border-red-300 text-red-700 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition disabled:opacity-60"
          >
            {busy === 'REJECT' ? 'Rejecting…' : 'Reject'}
          </button>
          {record.isLive && (
            <Link
              href={`/registry/${record.id}`}
              target="_blank"
              className="text-sm text-slate-500 hover:text-slate-700 ml-auto"
            >
              See the public page ↗
            </Link>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-8">{IP_DISCLAIMER}</p>
    </div>
  );
}
