'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getRealUser, setViewContext } from '@/lib/auth';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const user = getRealUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const viewAsUser = async (u: any) => {
    const ok = window.confirm(
      `View this account as ${u.name}?\n\nYou will temporarily view the platform from this user's perspective. Your admin session will remain active.`
    );
    if (!ok) return;
    setActionLoading(u.id + '_view');
    try {
      const res = await api.startViewAs(u.id);
      setViewContext({ token: res.viewToken, expiresAt: res.expiresAt, target: res.target });
      router.push(res.target.role === 'VALIDATOR' ? '/validator/dashboard' : '/founder');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Irreversible — everything the user ever created goes with them, so the
  // confirmation requires typing DELETE rather than one accidental click.
  const deleteUser = async (u: any) => {
    const typed = window.prompt(
      `Permanently delete ${u.name} (${u.email})?\n\nThis erases their account AND all their history: ideas, validations, surveys, responses, payments and activity. This cannot be undone.\n\nType DELETE to confirm:`
    );
    if (typed !== 'DELETE') return;
    setActionLoading(u.id + '_delete');
    try {
      await api.adminDeleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const toggleStatus = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await api.toggleUserStatus(id);
      setUsers(u => u.map(x => x.id === id ? { ...x, isActive: updated.isActive } : x));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const filtered = users.filter(u =>
    (!filter || u.role === filter) && u.role !== 'ADMIN'
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

      <div className="flex gap-2 mb-6">
        {['', 'FOUNDER', 'VALIDATOR'].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter === r ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'}`}>
            {r || 'All'}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      {/* overflow-x-auto, not overflow-hidden — six columns exceed a phone's width,
          and hidden clipped the Actions column with no way to reach it. */}
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
          <div className="text-center py-10 text-slate-500">No users found</div>
        )}
      </div>
    </div>
  );
}
