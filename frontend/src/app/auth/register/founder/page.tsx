'use client';
import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { storeAuth } from '@/lib/auth';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { FieldErrors, fieldClass, isEmail, isPhone, requireText, scrollToFirstError, summaryMessage } from '@/lib/formValidation';

// useSearchParams() requires a Suspense boundary for static prerendering —
// dev mode never enforces this, only a real `next build` does.
export default function RegisterFounderPage() {
  return (
    <Suspense fallback={null}>
      <RegisterFounderForm />
    </Suspense>
  );
}

function RegisterFounderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleEmailHint = searchParams.get('googleEmail');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', otp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [testOtp, setTestOtp] = useState(''); // shown on screen in test mode
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await api.googleRegisterFounder(idToken);
      storeAuth(res.access_token, res.user);
      router.push('/founder');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const clearFieldError = (key: string) =>
    setFieldErrors(prev => (prev[key] ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)) : prev));

  const sendOtp = async () => {
    if (!isPhone(form.phone)) {
      setFieldErrors(prev => ({ ...prev, phone: 'Enter a valid phone number with country code, e.g. +91 9876543210.' }));
      return;
    }
    clearFieldError('phone');
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

  // Rules mirror the backend RegisterFounderDto — nothing that passes here
  // can bounce off the server with a raw validation error.
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = requireText(form.name, 'Full name', 2);
    if (name) errors.name = name;
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!isEmail(form.email)) errors.email = 'Enter a valid email address, e.g. you@example.com.';
    const pw = requireText(form.password, 'Password', 8);
    if (pw) errors.password = pw;
    if (!isPhone(form.phone)) errors.phone = 'Enter a valid phone number with country code, e.g. +91 9876543210.';
    else if (!otpSent) errors.phone = 'Click "Send OTP" to verify this phone number first.';
    if (otpSent && form.otp.trim().length < 4) errors.otp = 'Enter the OTP shown above (at least 4 digits).';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(summaryMessage(errors));
      scrollToFirstError(errors);
      return false;
    }
    setError('');
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.registerFounder(form);
      storeAuth(res.access_token, res.user);
      router.push('/founder');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-md">
        <div className="mb-6">
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">Idea Founder</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-3 mb-1">Create your account</h1>
          <p className="text-slate-500 text-sm">Submit your business idea and get expert feedback</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        {googleEmailHint && (
          <div className="bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm">
            No account found for {googleEmailHint} — continue with Google below to create one.
          </div>
        )}

        <div className="mb-5">
          {googleLoading ? (
            <p className="text-center text-sm text-slate-500">Creating your account...</p>
          ) : (
            <GoogleSignInButton text="signup_with" onCredential={handleGoogleCredential} />
          )}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form noValidate onSubmit={submit} className="space-y-4">
          {[
            { key: 'name', label: 'Full Name', type: 'text', hint: undefined },
            { key: 'email', label: 'Email Address', type: 'email', hint: undefined },
            { key: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters.' },
          ].map(f => (
            <div key={f.key} id={`field-${f.key}`}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <input type={f.type}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors[f.key])}`}
                value={(form as any)[f.key]}
                onChange={e => { setForm({ ...form, [f.key]: e.target.value }); clearFieldError(f.key); }} />
              {fieldErrors[f.key]
                ? <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors[f.key]}</p>
                : f.hint && <p className="text-xs text-slate-500 mt-1">{f.hint}</p>}
            </div>
          ))}

          {/* Phone + OTP */}
          <div id="field-phone">
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number *</label>
            <div className="flex gap-2">
              <input type="tel" placeholder="+91 9876543210"
                className={`flex-1 border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors.phone)}`}
                value={form.phone}
                onChange={e => { setForm({ ...form, phone: e.target.value }); setOtpSent(false); setTestOtp(''); clearFieldError('phone'); }} />
              <button type="button" onClick={sendOtp} disabled={otpLoading || otpSent}
                className="px-4 py-2 text-sm font-semibold rounded-lg border transition whitespace-nowrap
                  disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed">
                {otpLoading ? 'Sending...' : otpSent ? 'OTP Sent ✓' : 'Send OTP'}
              </button>
            </div>
            {fieldErrors.phone
              ? <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.phone}</p>
              : <p className="text-xs text-slate-500 mt-1">We will not send unnecessary promotional messages.</p>}
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
            <div id="field-otp">
              <label className="block text-sm font-medium text-slate-700 mb-1">Enter OTP</label>
              <input type="text" maxLength={6} placeholder="6-digit OTP"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 tracking-widest text-center text-lg font-bold ${fieldClass(!!fieldErrors.otp)}`}
                value={form.otp}
                onChange={e => { setForm({ ...form, otp: e.target.value.replace(/\D/g, '') }); clearFieldError('otp'); }} />
              {fieldErrors.otp && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.otp}</p>}
            </div>
          )}

          {/* Deliberately NOT disabled before OTP verification — clicking runs
              validate(), which points at exactly what's missing instead of a
              dead button the user has to puzzle over. */}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Founder Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link href="/auth/login" className="text-blue-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
