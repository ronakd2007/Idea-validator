'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getAnalytics().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, color: 'bg-indigo-500' },
    { label: 'Founders', value: stats.totalFounders, color: 'bg-blue-500' },
    { label: 'Validators', value: stats.totalValidators, color: 'bg-purple-500' },
    { label: 'Total Ideas', value: stats.totalIdeas, color: 'bg-gray-600' },
    { label: 'Active Ideas', value: stats.activeIdeas, color: 'bg-green-500' },
    { label: 'Total Validations', value: stats.totalValidations, color: 'bg-teal-500' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, color: 'bg-yellow-500' },
    { label: 'Total Revenue', value: `$${(stats.totalRevenue || 0).toFixed(2)}`, color: 'bg-emerald-600' },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Platform overview and management</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/validators" className="border border-yellow-500 text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-50">
            Pending Approvals {stats?.pendingApprovals > 0 && <span className="ml-1 bg-yellow-500 text-white px-1.5 py-0.5 rounded-full text-xs">{stats.pendingApprovals}</span>}
          </Link>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-gray-400">Loading...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {cards.map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className={`w-8 h-8 ${c.color} rounded-lg mb-3`} />
                <div className="text-2xl font-black text-gray-900">{c.value}</div>
                <div className="text-sm text-gray-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { href: '/admin/validators', label: 'Manage Validators', desc: 'Approve or reject validator applications', icon: '✓' },
              { href: '/admin/users', label: 'Manage Users', desc: 'View and manage all platform users', icon: '👥' },
              { href: '/admin/ideas', label: 'Manage Ideas', desc: 'Review and moderate submitted ideas', icon: '💡' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-sm transition">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.label}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
