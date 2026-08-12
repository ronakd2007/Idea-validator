'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export default function AdminValidatorsPage() {
  const router = useRouter();
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getPendingValidators().then(setPending).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const approve = async (id: string) => {
    setActionLoading(id + '_approve');
    try {
      await api.approveValidator(id);
      setPending(p => p.filter(v => v.id !== id));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const reject = async (id: string) => {
    if (!confirm('Reject this validator application?')) return;
    setActionLoading(id + '_reject');
    try {
      await api.rejectValidator(id);
      setPending(p => p.filter(v => v.id !== id));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Validator Approvals</h1>
          <p className="text-slate-500 mt-1">Review LinkedIn profiles and approve or reject applications</p>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      {!loading && pending.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-slate-800">All caught up!</h2>
          <p className="text-slate-500 mt-2">No pending validator applications.</p>
        </div>
      )}

      <div className="space-y-4">
        {pending.map(v => (
          <div key={v.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{v.user.name}</h3>
                <p className="text-sm text-slate-500">{v.user.email}</p>
                <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Occupation:</span> <span className="font-medium text-slate-800">{v.occupation}</span></div>
                  <div><span className="text-slate-500">Experience:</span> <span className="font-medium text-slate-800">{v.yearsOfExperience} years</span></div>
                  <div><span className="text-slate-500">Expertise:</span> <span className="font-medium text-slate-800">{v.areasOfExpertise}</span></div>
                  <div><span className="text-slate-500">Registered:</span> <span className="font-medium text-slate-800">{new Date(v.user.createdAt).toLocaleDateString()}</span></div>
                </div>
                <div className="mt-3">
                  <span className="text-slate-500 text-sm">LinkedIn: </span>
                  <a href={v.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline break-all">{v.linkedinUrl}</a>
                </div>
                {v.contactPreferences && JSON.parse(v.contactPreferences).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {JSON.parse(v.contactPreferences).map((p: string) => (
                      <span key={p} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{p.replace('_', ' ')}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-4 flex flex-col gap-2">
                <button onClick={() => approve(v.id)} disabled={!!actionLoading}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {actionLoading === v.id + '_approve' ? 'Approving...' : 'Approve'}
                </button>
                <button onClick={() => reject(v.id)} disabled={!!actionLoading}
                  className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50">
                  {actionLoading === v.id + '_reject' ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
