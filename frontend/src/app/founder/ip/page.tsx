'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import IpRecordCard from '@/components/founder/IpRecordCard';
import { IP_DISCLAIMER } from '@/lib/ipTypes';

export default function MyIpPage() {
  const router = useRouter();
  const [records, setRecords] = useState<any[] | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') {
      router.push('/auth/login');
      return;
    }
    api
      .getMyIpRecords()
      .then((res: any) => setRecords(res.records ?? []))
      .catch(() => setRecords([]));
  }, []);

  const addButton = (
    <Link
      href="/founder/ip/new"
      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
    >
      + Add IP / Patent
    </Link>
  );

  // Anything the founder needs to act on floats to the top of the page.
  const needsAttention = (records ?? []).filter((r) => r.reviewStatus === 'CHANGES_REQUESTED');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <PageHeader
        title="IP &amp; Patents"
        subtitle="Keep a record of the patents, trademarks and other IP behind your work."
        actions={records && records.length > 0 ? addButton : undefined}
      />

      {needsAttention.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-amber-900">
            <span className="font-medium">
              {needsAttention.length} record{needsAttention.length === 1 ? '' : 's'} need
              {needsAttention.length === 1 ? 's' : ''} a change
            </span>{' '}
            before it can go on the public registry.
          </p>
        </div>
      )}

      {records === null ? (
        <SkeletonList count={3} />
      ) : records.length === 0 ? (
        <EmptyState
          icon="📜"
          title="No IP records yet"
          body="Filed a patent, registered a trademark, or planning to? Record it here so it stays in one place — and choose later whether to show it publicly."
          action={addButton}
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {records.map((r) => (
              <IpRecordCard key={r.id} record={r} />
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-8 max-w-2xl">
            {IP_DISCLAIMER} IdeaValidator does not file, register or grant any intellectual property.
          </p>
        </>
      )}
    </div>
  );
}
