'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getRealUser, setViewContext } from '@/lib/auth';
import { useToast, useConfirm } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function AdminUsersPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const user = getRealUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const viewAsUser = async (u: any) => {
    const ok = await confirm({
      title: `View as ${u.name}?`,
      body: "You will temporarily see the platform from this user's perspective, read-only. Your admin session stays active — exit any time from the banner.",
      confirmLabel: 'Start View Mode',
    });
    if (!ok) return;
    setActionLoading(u.id + '_view');
    try {
      const res = await api.startViewAs(u.id);
      setViewContext({ token: res.viewToken, expiresAt: res.expiresAt, target: res.target });
      router.push(res.target.role === 'VALIDATOR' ? '/validator/dashboard' : '/founder');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Irreversible — everything the user ever created goes with them, so the
  // confirmation requires typing DELETE rather than one accidental click.
  const deleteUser = async (u: any) => {
    const ok = await confirm({
      title: `Permanently delete ${u.name}?`,
      body: `This erases ${u.email}'s account AND all their history: ideas, validations, surveys, responses, payments and activity. This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      danger: true,
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    setActionLoading(u.id + '_delete');
    try {
      await api.adminDeleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success(`${u.name} and all their data have been deleted.`);
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const toggleStatus = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await api.toggleUserStatus(id);
      setUsers(u => u.map(x => x.id === id ? { ...x, isActive: updated.isActive } : x));
      toast.success(updated.isActive ? 'Account activated.' : 'Account deactivated — they can no longer sign in.');
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const term = search.trim().toLowerCase();
  const filtered = users.filter(u =>
    (!filter || u.role === filter) && u.role !== 'ADMIN' &&
    (!term || u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
  );

  const roleColor: Record<string, string> = {
    FOUNDER: 'bg-blue-50 text-blue-700',
    VALIDATOR: 'bg-emerald-50 text-emerald-700',
    ADMIN: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-slate-500 mt-1">{filtered.length} users</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {['', 'FOUNDER', 'VALIDATOR'].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter === r ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'}`}>
            {r || 'All'}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="ml-auto w-full sm:w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {/* overflow-x-auto, not overflow-hidden — six columns exceed a phone's width,
          and hidden clipped the Actions column with no way to reach it. */}
      {!loading && (
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-slate-500">Name</th>
              <th className="text-left px-6 py-3 font-medium text-slate-500">Email</th>
              <th className="text-left px-6 py-3 font-medium text-slate-500">Role</th>
              <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
              <th className="text-left px-6 py-3 font-medium text-slate-500">Joined</th>
              <th className="text-left px-6 py-3 font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">
                  <Link href={`/admin/users/${u.id}`} className="text-blue-600 hover:text-blue-700">{u.name}</Link>
                </td>
                <td className="px-6 py-4 text-slate-500">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColor[u.role]}`}>{u.role}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/users/${u.id}`}
                      className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-600 font-medium hover:border-blue-400 hover:text-blue-600 transition">
                      Details
                    </Link>
                    {u.role !== 'ADMIN' && (
                      <button onClick={() => viewAsUser(u)} disabled={actionLoading === u.id + '_view'}
                        title="Temporarily view the platform from this user's perspective"
                        className="text-xs px-3 py-1 rounded border border-amber-300 text-amber-700 font-medium hover:bg-amber-50 transition disabled:opacity-50">
                        {actionLoading === u.id + '_view' ? '...' : 'View as User'}
                      </button>
                    )}
                    <button onClick={() => toggleStatus(u.id)} disabled={actionLoading === u.id}
                      className={`text-xs px-3 py-1 rounded border font-medium transition disabled:opacity-50 ${u.isActive ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                      {actionLoading === u.id ? '...' : u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => deleteUser(u)} disabled={actionLoading === u.id + '_delete'}
                      title="Permanently delete this user and all their data"
                      className="text-xs px-3 py-1 rounded border border-red-300 bg-red-50 text-red-700 font-medium hover:bg-red-100 transition disabled:opacity-50">
                      {actionLoading === u.id + '_delete' ? '...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <EmptyState
            compact
            title="No users match"
            body={term || filter ? 'Try clearing the search or role filter.' : 'New founders and validators appear here as they register.'}
          />
        )}
      </div>
      )}
    </div>
  );
}
