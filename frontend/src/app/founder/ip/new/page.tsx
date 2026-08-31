'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import PageHeader from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/feedback';
import IpRecordForm, { emptyIpForm, toIpPayload, IpFormValue } from '@/components/founder/IpRecordForm';
import { IP_DISCLAIMER } from '@/lib/ipTypes';

export default function NewIpRecordPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<IpFormValue>(emptyIpForm);
  const [ideas, setIdeas] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') {
      router.push('/auth/login');
      return;
    }
    api
      .getMyIdeas()
      .then((rows: any[]) => setIdeas((rows ?? []).map((i) => ({ id: i.id, title: i.title }))))
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!form.title.trim()) {
      setError('Give the record a title so you can find it later.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.createIpRecord(toIpPayload(form));
      toast.success(
        form.makePublic ? 'Saved and sent for review.' : 'Saved. Only you can see this.'
      );
      // Straight to the record so documents can be attached — uploads need an
      // id to hang off, so they are deliberately unavailable until now.
      router.push(`/founder/ip/${created.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not save the record.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/founder/ip" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to IP &amp; Patents
      </Link>

      <PageHeader
        title="Add IP / Patent"
        subtitle="Only a title and a type are required. Everything else can wait until you have it."
        className="mt-4"
      />

      <IpRecordForm
        value={form}
        onChange={setForm}
        ideas={ideas}
        documents={[]}
        onAddDocument={() => {}}
        onRemoveDocument={() => {}}
        documentsDisabled
        documentsDisabledNote="Save the record first — then you can attach files to it."
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
          {saving ? 'Saving…' : form.makePublic ? 'Save & send for review' : 'Save record'}
        </button>
        <Link href="/founder/ip" className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </Link>
      </div>

      <p className="text-xs text-slate-400 mt-8">{IP_DISCLAIMER}</p>
    </div>
  );
}
