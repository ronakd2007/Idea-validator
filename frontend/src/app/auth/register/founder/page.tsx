'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { storeAuth } from '@/lib/auth';

export default function RegisterFounderPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', otp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [testOtp, setTestOtp] = useState(''); // shown on screen in test mode

  const sendOtp = async () => {
    if (!form.phone || form.phone.length < 7) { setError('Enter a valid phone number'); return; }
    setError('');
    setOtpLoading(true);
    try {
      const res = await api.sendOtp(form.phone);
      setTestOtp(res.otp);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) { setError('Please verify your phone number first'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.registerFounder(form);
      storeAuth(res.access_token, res.user);
      router.push('/founder/ideas');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-6">
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Idea Founder</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-1">Create your account</h1>
          <p className="text-gray-500 text-sm">Submit your business idea and get expert feedback</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {[
            { key: 'name', label: 'Full Name', type: 'text' },
            { key: 'email', label: 'Email Address', type: 'email' },
            { key: 'password', label: 'Password', type: 'password' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input type={f.type} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}

          {/* Phone + OTP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
            <div className="flex gap-2">
              <input type="tel" required placeholder="+91 9876543210"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.phone}
                onChange={e => { setForm({ ...form, phone: e.target.value }); setOtpSent(false); setTestOtp(''); }} />
              <button type="button" onClick={sendOtp} disabled={otpLoading || otpSent}
                className="px-4 py-2 text-sm font-semibold rounded-lg border transition whitespace-nowrap
                  disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed">
                {otpLoading ? 'Sending...' : otpSent ? 'OTP Sent ✓' : 'Send OTP'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">We will not send unnecessary promotional messages.</p>
          </div>

          {/* Test mode OTP display */}
          {testOtp && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">TEST MODE — Your OTP</p>
              <p className="text-2xl font-black tracking-widest text-amber-800">{testOtp}</p>
              <p className="text-xs text-amber-600 mt-1">Valid for 10 minutes. In production, this will be sent via SMS.</p>
            </div>
          )}

          {otpSent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
              <input type="text" required maxLength={6} placeholder="6-digit OTP"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest text-center text-lg font-bold"
                value={form.otp}
                onChange={e => setForm({ ...form, otp: e.target.value.replace(/\D/g, '') })} />
            </div>
          )}

          <button type="submit" disabled={loading || !otpSent}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Founder Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link href="/auth/login" className="text-indigo-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
