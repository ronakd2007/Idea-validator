'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
    <div className="max-w-5xl mx-auto px-6 py-10">
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

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <table className="w-full text-sm">
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
                <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
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
                  <button onClick={() => toggleStatus(u.id)} disabled={actionLoading === u.id}
                    className={`text-xs px-3 py-1 rounded border font-medium transition disabled:opacity-50 ${u.isActive ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                    {actionLoading === u.id ? '...' : u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
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
