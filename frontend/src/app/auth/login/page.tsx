'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { storeAuth } from '@/lib/auth';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const goToRoleHome = (user: any) => {
    if (user.role === 'FOUNDER') router.push('/founder');
    else if (user.role === 'VALIDATOR') router.push('/validator/dashboard');
    else if (user.role === 'ADMIN') router.push('/admin');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(form);
      storeAuth(res.access_token, res.user);
      goToRoleHome(res.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await api.googleLogin(idToken);
      if (res.needsRegistration) {
        router.push(`/auth/register/founder?googleEmail=${encodeURIComponent(res.email)}&googleName=${encodeURIComponent(res.name)}`);
        return;
      }
      storeAuth(res.access_token, res.user);
      goToRoleHome(res.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h1>
        <p className="text-slate-500 mb-6 text-sm">Sign in to your account</p>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {googleLoading ? (
          <p className="text-center text-sm text-slate-500">Signing in...</p>
        ) : (
          <GoogleSignInButton text="signin_with" onCredential={handleGoogleCredential} />
        )}

        <div className="mt-6 text-center text-sm text-slate-500 space-y-2">
          <p>No account? <Link href="/auth/register/founder" className="text-blue-600 font-medium">Register as Founder</Link></p>
          <p>Want to review ideas? <Link href="/auth/register/validator" className="text-blue-600 font-medium">Become a Validator</Link></p>
        </div>
      </div>
    </div>
  );
}
