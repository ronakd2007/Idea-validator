'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast, useConfirm } from '@/components/ui/feedback';
import IpRecordForm, { fromIpRecord, toIpPayload, IpFormValue } from '@/components/founder/IpRecordForm';
import { UploadedDocument } from '@/components/founder/DocumentUpload';
import { ipReviewMeta, IP_DISCLAIMER } from '@/lib/ipTypes';

export default function EditIpRecordPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [record, setRecord] = useState<any>(null);
  const [form, setForm] = useState<IpFormValue | null>(null);
  const [ideas, setIdeas] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    try {
      const res = await api.getIpRecord(id);
      setRecord(res);
      setForm(fromIpRecord(res));
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') {
      router.push('/auth/login');
      return;
    }
    load();
    api
      .getMyIdeas()
      .then((rows: any[]) => setIdeas((rows ?? []).map((i) => ({ id: i.id, title: i.title }))))
      .catch(() => {});
  }, [id]);

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      setError('Give the record a title so you can find it later.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateIpRecord(id, toIpPayload(form));
      setRecord(updated);
      setForm(fromIpRecord(updated));
      // The message has to name what actually happened — "saved" would hide
      // that a live record just went back into the review queue.
      if (updated.reviewStatus === 'PENDING_REVIEW' && record?.reviewStatus !== 'PENDING_REVIEW') {
        toast.success('Saved and sent for review.');
      } else if (updated.visibility === 'PRIVATE' && record?.isLive) {
        toast.success('Taken off the public registry. Only you can see it now.');
      } else {
        toast.success('Saved.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  };

  const addDocument = async (doc: UploadedDocument) => {
    try {
      setRecord(await api.addIpDocument(id, doc));
      toast.success('File attached.');
    } catch (err: any) {
      toast.error(err.message || 'Could not attach that file.');
    }
  };

  const removeDocument = async (doc: UploadedDocument) => {
    if (!doc.id) return;
    const ok = await confirm({
      title: 'Remove this file?',
      body: `"${doc.fileName}" will be removed from this record.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      setRecord(await api.deleteIpDocument(id, doc.id));
      toast.success('File removed.');
    } catch (err: any) {
      toast.error(err.message || 'Could not remove that file.');
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this IP record?',
      body: 'The record and any files attached to it are removed for good. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteIpRecord(id);
      toast.success('Record deleted.');
      router.push('/founder/ip');
    } catch (err: any) {
      toast.error(err.message || 'Could not delete the record.');
    }
  };

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-800">Record not found</h1>
        <p className="text-slate-500 mt-2">It may have been deleted, or it belongs to another account.</p>
        <Link href="/founder/ip" className="text-blue-700 hover:underline text-sm mt-4 inline-block">
          Back to IP &amp; Patents
        </Link>
      </div>
    );
  }

  if (!record || !form) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <SkeletonCard />
      </div>
    );
  }

  const review = ipReviewMeta(record.reviewStatus);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/founder/ip" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to IP &amp; Patents
      </Link>

      <PageHeader
        title={record.title}
        subtitle="Change anything here and save. Your notes and files stay private either way."
        className="mt-4"
        actions={<StatusBadge tone={review.tone}>{review.label}</StatusBadge>}
      />

      {/* One line saying where this record stands and what, if anything, to do. */}
      <div
        className={`rounded-xl border px-4 py-3 mb-6 ${
          record.reviewStatus === 'CHANGES_REQUESTED' || record.reviewStatus === 'REJECTED'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <p className="text-sm text-slate-700">{review.blurb}</p>
        {record.reviewMessage && (
          <p className="text-sm text-slate-800 mt-2 font-medium">
            Our team said: <span className="font-normal">{record.reviewMessage}</span>
          </p>
        )}
        {record.isLive && (
          <Link
            href={`/registry/${record.id}`}
            target="_blank"
            className="text-sm text-blue-700 hover:underline mt-2 inline-block"
          >
            See the public page ↗
          </Link>
        )}
      </div>

      <IpRecordForm
        value={form}
        onChange={setForm}
        ideas={ideas}
        documents={record.documents ?? []}
        onAddDocument={addDocument}
        onRemoveDocument={removeDocument}
      />

      {error && (
        <p className="text-sm text-red-600 font-medium mt-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={remove} className="text-sm text-red-600 hover:underline ml-auto">
          Delete this record
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-8">{IP_DISCLAIMER}</p>
    </div>
  );
}
