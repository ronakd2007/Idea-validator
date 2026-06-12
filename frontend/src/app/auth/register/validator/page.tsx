'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const CONTACT_OPTIONS = [
  { value: 'BETA_TESTING', label: 'Beta Testing' },
  { value: 'MENTORSHIP', label: 'Mentorship' },
  { value: 'INVESTMENT', label: 'Investment Opportunities' },
  { value: 'PARTNERSHIPS', label: 'Partnerships' },
];

const EXPERTISE_OPTIONS = ['Technology', 'Finance', 'Marketing', 'Healthcare', 'Education',
  'E-commerce', 'SaaS', 'Consumer Products', 'Real Estate', 'Media', 'Sustainability', 'Other'];

export default function RegisterValidatorPage() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', otp: '', occupation: '',
    yearsOfExperience: 1, linkedinUrl: '',
    areasOfExpertise: [] as string[],
    contactPreferences: [] as string[],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [testOtp, setTestOtp] = useState('');

  const toggleArr = (key: 'areasOfExpertise' | 'contactPreferences', val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }));
  };

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
    if (form.areasOfExpertise.length === 0) { setError('Select at least one area of expertise'); return; }
    if (!otpSent) { setError('Please verify your phone number first'); return; }
    setError('');
    setLoading(true);
    try {
      await api.registerValidator(form);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-md text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Application Submitted!</h2>
          <p className="text-gray-500 mb-6">Your validator profile is pending admin approval. You will be able to log in once approved.</p>
          <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-2xl">
        <div className="mb-6">
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Idea Validator</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-1">Become a Validator</h1>
          <p className="text-gray-500 text-sm">Review and evaluate business ideas. Profile requires admin approval.</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Full Name', type: 'text' },
              { key: 'email', label: 'Email Address', type: 'email' },
              { key: 'password', label: 'Password', type: 'password' },
              { key: 'occupation', label: 'Occupation / Job Title', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input type={f.type} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>

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
                  bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {otpLoading ? 'Sending...' : otpSent ? 'OTP Sent ✓' : 'Send OTP'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">We will not send unnecessary promotional messages.</p>
          </div>

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

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
              <input type="number" min={0} max={50} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.yearsOfExperience}
                onChange={e => setForm({ ...form, yearsOfExperience: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
              <input type="url" required placeholder="https://linkedin.com/in/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.linkedinUrl}
                onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Areas of Expertise</label>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_OPTIONS.map(opt => (
                <button type="button" key={opt}
                  onClick={() => toggleArr('areasOfExpertise', opt)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${form.areasOfExpertise.includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Sharing Preferences</label>
            <p className="text-xs text-gray-500 mb-2">Choose when founders can contact you</p>
            <div className="flex flex-wrap gap-2">
              {CONTACT_OPTIONS.map(opt => (
                <button type="button" key={opt.value}
                  onClick={() => toggleArr('contactPreferences', opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${form.contactPreferences.includes(opt.value) ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-400'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || !otpSent}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Validator Application'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link href="/auth/login" className="text-indigo-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
