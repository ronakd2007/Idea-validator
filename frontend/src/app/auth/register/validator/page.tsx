'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FieldErrors, fieldClass, isEmail, isPhone, isUrl, requireText, scrollToFirstError, summaryMessage } from '@/lib/formValidation';

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

  // Rules mirror the backend RegisterValidatorDto — nothing that passes here
  // can bounce off the server with a raw validation error.
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = requireText(form.name, 'Full name', 2);
    if (name) errors.name = name;
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!isEmail(form.email)) errors.email = 'Enter a valid email address, e.g. you@example.com.';
    const pw = requireText(form.password, 'Password', 8);
    if (pw) errors.password = pw;
    const occ = requireText(form.occupation, 'Occupation', 2);
    if (occ) errors.occupation = occ;
    if (!isPhone(form.phone)) errors.phone = 'Enter a valid phone number with country code, e.g. +91 9876543210.';
    else if (!otpSent) errors.phone = 'Click "Send OTP" to verify this phone number first.';
    if (otpSent && form.otp.trim().length < 4) errors.otp = 'Enter the OTP shown above (at least 4 digits).';
    if (form.yearsOfExperience < 0 || form.yearsOfExperience > 60 || Number.isNaN(form.yearsOfExperience)) {
      errors.yearsOfExperience = 'Years of experience must be between 0 and 60.';
    }
    if (!form.linkedinUrl.trim()) errors.linkedinUrl = 'LinkedIn profile URL is required — the admin reviews it to approve you.';
    else if (!isUrl(form.linkedinUrl)) errors.linkedinUrl = 'Enter a full URL starting with https://, e.g. https://linkedin.com/in/yourname.';
    if (form.areasOfExpertise.length === 0) errors.areasOfExpertise = 'Select at least one area of expertise.';

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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 w-full max-w-md text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Submitted!</h2>
          <p className="text-slate-500 mb-6">Your validator profile is pending admin approval. You will be able to log in once approved.</p>
          <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-2xl">
        <div className="mb-6">
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium">For investors, operators &amp; mentors</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-3 mb-1">See new startup ideas first</h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Review early-stage ideas from founders in your industry — and get their contact details the moment you do.
            Invest, mentor, hire or partner with the ones you like.
          </p>

          {/* Leads with what the validator gets. The work is real (a structured
              review across 12 frameworks), so the reasons to do it have to be
              on the page, not assumed. */}
          <ul className="mt-4 space-y-2">
            {[
              ['🔍', 'Early access to real ideas', 'See what founders are building before anyone else — often months before launch.'],
              ['🤝', 'Direct line to the founder', 'Your contact details go to every founder you review. Say whether you are open to investing, mentoring, hiring or partnering.'],
              ['🚀', 'First look at the Startup Directory', 'Validated startups are listed publicly — you see them before the public does.'],
              ['🎓', 'A public expert profile', 'Build a visible track record of the ideas you have reviewed.'],
            ].map(([icon, title, body]) => (
              <li key={title} className="flex gap-2.5">
                <span className="shrink-0 text-base leading-6" aria-hidden>{icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{title}</span>
                  <span className="block text-xs text-slate-500 leading-relaxed">{body}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-500 mt-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed">
            <span className="font-semibold text-slate-700">What it involves:</span> about 20–30 minutes per idea —
            you score it across 12 areas and write what is strong, what is weak, and what you would fix.
            Review as many or as few as you like. Applications are checked by our team before approval.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <form noValidate onSubmit={submit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Full Name', type: 'text' },
              { key: 'email', label: 'Email Address', type: 'email' },
              { key: 'password', label: 'Password', type: 'password' },
              { key: 'occupation', label: 'Occupation / Job Title', type: 'text' },
            ].map(f => (
              <div key={f.key} id={`field-${f.key}`}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                <input type={f.type}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors[f.key])}`}
                  value={(form as any)[f.key]}
                  onChange={e => { setForm({ ...form, [f.key]: e.target.value }); clearFieldError(f.key); }} />
                {fieldErrors[f.key] && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors[f.key]}</p>}
              </div>
            ))}
          </div>

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
                  bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {otpLoading ? 'Sending...' : otpSent ? 'OTP Sent ✓' : 'Send OTP'}
              </button>
            </div>
            {fieldErrors.phone
              ? <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.phone}</p>
              : <p className="text-xs text-slate-500 mt-1">Required. Shared with founders when you submit a validation, so they can follow up with you directly.</p>}
          </div>

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

          <div className="grid md:grid-cols-2 gap-4">
            <div id="field-yearsOfExperience">
              <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience</label>
              <input type="number" min={0} max={60}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors.yearsOfExperience)}`}
                value={form.yearsOfExperience}
                onChange={e => { setForm({ ...form, yearsOfExperience: Number(e.target.value) }); clearFieldError('yearsOfExperience'); }} />
              {fieldErrors.yearsOfExperience && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.yearsOfExperience}</p>}
            </div>
            <div id="field-linkedinUrl">
              <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn Profile URL *</label>
              <input type="url" placeholder="https://linkedin.com/in/..."
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors.linkedinUrl)}`}
                value={form.linkedinUrl}
                onChange={e => { setForm({ ...form, linkedinUrl: e.target.value }); clearFieldError('linkedinUrl'); }} />
              {fieldErrors.linkedinUrl
                ? <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.linkedinUrl}</p>
                : <p className="text-xs text-slate-500 mt-1">Required. Shared with founders when you submit a validation.</p>}
            </div>
          </div>

          <div id="field-areasOfExpertise">
            <label className="block text-sm font-medium text-slate-700 mb-2">Areas of Expertise</label>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_OPTIONS.map(opt => (
                <button type="button" key={opt}
                  onClick={() => { toggleArr('areasOfExpertise', opt); clearFieldError('areasOfExpertise'); }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${form.areasOfExpertise.includes(opt) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                  {opt}
                </button>
              ))}
            </div>
            {fieldErrors.areasOfExpertise && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.areasOfExpertise}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Contact Sharing Preferences</label>
            <p className="text-xs text-slate-500 mb-2">Choose when founders can contact you</p>
            <div className="flex flex-wrap gap-2">
              {CONTACT_OPTIONS.map(opt => (
                <button type="button" key={opt.value}
                  onClick={() => toggleArr('contactPreferences', opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${form.contactPreferences.includes(opt.value) ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 text-slate-600 hover:border-emerald-400'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Not disabled pre-OTP: clicking runs validate(), which names the
              exact missing fields instead of leaving a dead button. */}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Validator Application'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link href="/auth/login" className="text-blue-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
