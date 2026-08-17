'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser, isViewMode } from '@/lib/auth';
import { useToast } from '@/components/ui/feedback';
import { FieldErrors, fieldClass, requireText, scrollToFirstError } from '@/lib/formValidation';
import LogoUpload from '@/components/founder/LogoUpload';
import StatusBadge from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { LOOKING_FOR_OPTIONS, STARTUP_STAGES, STARTUP_STATUS_META } from '@/lib/startupTypes';

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce',
  'Food & Beverage', 'Manufacturing', 'Real Estate', 'Water Technology', 'Agriculture',
  'Energy', 'Transportation', 'Retail', 'Media', 'Other'];

type Team = { name: string; linkedinUrl: string };

export default function ListStartupPage() {
  const router = useRouter();
  const params = useParams();
  const ideaId = params.id as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [reviewMessage, setReviewMessage] = useState('');
  const [slug, setSlug] = useState('');
  const [viewMode, setViewMode] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [form, setForm] = useState({
    name: '', logoUrl: '', tagline: '', about: '', problem: '', solution: '',
    product: '', traction: '', industry: INDUSTRIES[0], location: '',
    foundedYear: '' as string | number, website: '', linkedinUrl: '', stage: 'IDEA',
  });
  const [team, setTeam] = useState<Team[]>([{ name: '', linkedinUrl: '' }]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [display, setDisplay] = useState({ showScore: false, showValidatorCount: false, showCustomerValidation: false });

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    setViewMode(isViewMode());

    api.getStartupForIdea(ideaId)
      .then((res: any) => {
        const s = res.startup;
        const p = res.prefill || {};
        if (s) {
          setStatus(s.status);
          setReviewMessage(s.reviewMessage || '');
          setSlug(s.slug || '');
          setForm({
            name: s.name || '', logoUrl: s.logoUrl || '', tagline: s.tagline || '', about: s.about || '',
            problem: s.problem || '', solution: s.solution || '', product: s.product || '', traction: s.traction || '',
            industry: s.industry || p.industry || INDUSTRIES[0], location: s.location || '',
            foundedYear: s.foundedYear ?? '', website: s.website || '', linkedinUrl: s.linkedinUrl || '',
            stage: s.stage || p.stage || 'IDEA',
          });
          setTeam(s.teamMembers?.length ? s.teamMembers.map((t: any) => ({ name: t.name || '', linkedinUrl: t.linkedinUrl || '' })) : [{ name: '', linkedinUrl: '' }]);
          setLookingFor(s.lookingFor || []);
          setDisplay({ ...display, ...(s.validationDisplay || {}) });
        } else {
          // First visit: start from what the founder already told us about the idea.
          setForm((f) => ({
            ...f,
            name: p.name || '', problem: p.problem || '', solution: p.solution || '',
            industry: INDUSTRIES.includes(p.industry) ? p.industry : (p.industry || INDUSTRIES[0]),
            stage: p.stage || 'IDEA',
          }));
          const t = (p.teamMembers || []).map((x: any) => ({ name: x.name || '', linkedinUrl: x.linkedinUrl || '' }));
          setTeam(t.length ? t : [{ name: p.founderName || '', linkedinUrl: '' }]);
        }
      })
      .catch((err: any) => setBlocked(err.message || 'This idea cannot be listed yet.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId, router]);

  const set = (k: string, v: any) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
  };

  const toggleLooking = (v: string) =>
    setLookingFor((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const payload = (submit: boolean) => ({
    ...form,
    foundedYear: form.foundedYear === '' ? undefined : Number(form.foundedYear),
    teamMembers: team.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), linkedinUrl: t.linkedinUrl.trim() || undefined })),
    lookingFor,
    validationDisplay: display,
    submit,
  });

  const validate = () => {
    const e: FieldErrors = {};
    const put = (field: string, msg: string | null) => { if (msg) e[field] = msg; };
    put('name', requireText(form.name, 'Startup name'));
    put('tagline', requireText(form.tagline, 'A one-line description'));
    put('industry', requireText(form.industry, 'Industry'));
    put('location', requireText(form.location, 'Location'));
    put('problem', requireText(form.problem, 'The problem you solve'));
    put('solution', requireText(form.solution, 'Your solution'));
    setErrors(e);
    if (Object.keys(e).length) { scrollToFirstError(e); return false; }
    return true;
  };

  const save = async (submit: boolean) => {
    if (submit && !validate()) return;
    if (!form.name.trim()) { setErrors({ name: 'Startup name is required.' }); scrollToFirstError({ name: '1' }); return; }
    setSaving(true);
    try {
      const res = await api.saveStartupForIdea(ideaId, payload(submit));
      setStatus(res.status);
      setSlug(res.slug || '');
      setReviewMessage(res.reviewMessage || '');
      toast.success(submit ? 'Submitted — our team will review your listing.' : 'Draft saved.');
      if (submit) router.push(`/founder/ideas/${ideaId}/dashboard`);
    } catch (err: any) {
      toast.error(err.message || 'Could not save your listing.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Not ready to list yet</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">{blocked}</p>
        <Link href={`/founder/ideas/${ideaId}/dashboard`} className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700">
          Back to my idea
        </Link>
      </div>
    );
  }

  const meta = STARTUP_STATUS_META[status] || STARTUP_STATUS_META.DRAFT;
  const locked = status === 'APPROVED' || status === 'REJECTED' || viewMode;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <Link href={`/founder/ideas/${ideaId}/dashboard`} className="text-sm text-slate-500 hover:text-slate-800">&larr; Back to my idea</Link>

      <div className="mt-4 mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">🚀 List My Startup</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create a public profile so people can find you. We&apos;ve filled in what we already know from your idea — edit anything.
          </p>
        </div>
        <StatusBadge tone={meta.tone} dot>{meta.label}</StatusBadge>
      </div>

      {status === 'CHANGES_REQUESTED' && reviewMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-amber-900 mb-1">Our team asked for a few changes</p>
          <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">{reviewMessage}</p>
          <p className="text-xs text-amber-700/80 mt-2">Make the changes below, then submit again.</p>
        </div>
      )}

      {locked && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
          <p className="text-sm text-slate-700">
            {viewMode ? 'Editing is disabled while viewing as another user.' : meta.blurb}
            {status === 'APPROVED' && slug && (
              <> <Link href={`/startups/${slug}`} className="text-blue-600 font-medium hover:underline">View your public profile →</Link></>
            )}
          </p>
        </div>
      )}

      <fieldset disabled={locked} className="space-y-6">
        {/* ---- identity ---- */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">The basics</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo</label>
            <LogoUpload value={form.logoUrl} onChange={(url) => set('logoUrl', url)} />
          </div>

          <div id="field-name">
            <label className="block text-sm font-medium text-slate-700 mb-1">Startup name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!errors.name)}`} />
            {errors.name && <p className="text-xs text-red-600 mt-1 font-medium">{errors.name}</p>}
          </div>

          <div id="field-tagline">
            <label className="block text-sm font-medium text-slate-700 mb-1">One-line description *</label>
            <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)}
              placeholder="AI-powered water quality monitoring."
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!errors.tagline)}`} />
            {errors.tagline
              ? <p className="text-xs text-red-600 mt-1 font-medium">{errors.tagline}</p>
              : <p className="text-xs text-slate-500 mt-1">One sentence. This is what shows on your card in the directory.</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div id="field-industry">
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry *</label>
              <select value={form.industry} onChange={(e) => set('industry', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 ${fieldClass(!!errors.industry)}`}>
                {!INDUSTRIES.includes(form.industry) && form.industry && <option value={form.industry}>{form.industry}</option>}
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div id="field-location">
              <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Gujarat, India"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!errors.location)}`} />
              {errors.location && <p className="text-xs text-red-600 mt-1 font-medium">{errors.location}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select value={form.stage} onChange={(e) => set('stage', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900">
                {STARTUP_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Founded year</label>
              <input type="number" min={1900} max={2100} value={form.foundedYear}
                onChange={(e) => set('foundedYear', e.target.value)} placeholder="2024"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
              <input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://yourstartup.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn</label>
              <input value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/company/..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
            </div>
          </div>
        </section>

        {/* ---- story ---- */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900">Your story</h2>
            <p className="text-xs text-slate-500 mt-0.5">Problem and solution are filled in from your idea — edit them for a public audience.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">About</label>
            <textarea rows={3} value={form.about} onChange={(e) => set('about', e.target.value)}
              placeholder="A short introduction to your startup."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 resize-none" />
          </div>

          <div id="field-problem">
            <label className="block text-sm font-medium text-slate-700 mb-1">Problem *</label>
            <textarea rows={3} value={form.problem} onChange={(e) => set('problem', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 ${fieldClass(!!errors.problem)}`} />
            {errors.problem && <p className="text-xs text-red-600 mt-1 font-medium">{errors.problem}</p>}
          </div>

          <div id="field-solution">
            <label className="block text-sm font-medium text-slate-700 mb-1">Solution *</label>
            <textarea rows={3} value={form.solution} onChange={(e) => set('solution', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 ${fieldClass(!!errors.solution)}`} />
            {errors.solution && <p className="text-xs text-red-600 mt-1 font-medium">{errors.solution}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea rows={2} value={form.product} onChange={(e) => set('product', e.target.value)}
              placeholder="What have you actually built so far?"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Traction <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea rows={2} value={form.traction} onChange={(e) => set('traction', e.target.value)}
              placeholder="Users, revenue, pilots, partnerships — anything real."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 resize-none" />
            <p className="text-xs text-slate-500 mt-1">Leave blank if it&apos;s early — the section is simply hidden.</p>
          </div>
        </section>

        {/* ---- team ---- */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Team</h2>
          <p className="text-xs text-slate-500 mb-4">Who is building this.</p>
          <div className="space-y-2">
            {team.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input value={m.name} placeholder="Name"
                  onChange={(e) => setTeam((t) => t.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
                <input value={m.linkedinUrl} placeholder="LinkedIn (optional)"
                  onChange={(e) => setTeam((t) => t.map((x, j) => (j === i ? { ...x, linkedinUrl: e.target.value } : x)))}
                  className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
                {team.length > 1 && (
                  <button type="button" onClick={() => setTeam((t) => t.filter((_, j) => j !== i))}
                    className="text-slate-300 hover:text-red-500 px-1 shrink-0">&times;</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setTeam((t) => [...t, { name: '', linkedinUrl: '' }])}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-3">+ Add team member</button>
        </section>

        {/* ---- looking for ---- */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-1">What are you looking for?</h2>
          <p className="text-xs text-slate-500 mb-4">Shown on your card so the right people reach out.</p>
          <div className="flex flex-wrap gap-2">
            {LOOKING_FOR_OPTIONS.map((o) => {
              const on = lookingFor.includes(o.value);
              return (
                <button key={o.value} type="button" onClick={() => toggleLooking(o.value)}
                  className={`text-sm px-3.5 py-2 rounded-lg border font-medium transition ${
                    on ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {on ? '✓ ' : ''}{o.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ---- validation visibility ---- */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Validation on your profile</h2>
          <p className="text-xs text-slate-500 mb-4">
            Optional. Nothing from your private report is ever published — no validator names, no written feedback,
            no survey answers. Only the numbers you tick below.
          </p>
          <div className="space-y-2.5">
            {([
              ['showScore', 'Show my validation score'],
              ['showValidatorCount', 'Show how many experts reviewed my idea'],
              ['showCustomerValidation', 'Show customer validation percentages'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={(display as any)[key]}
                  onChange={(e) => setDisplay((d) => ({ ...d, [key]: e.target.checked }))}
                  className="accent-blue-600 w-4 h-4" />
                {label}
              </label>
            ))}
          </div>
        </section>
      </fieldset>

      {!locked && (
        <div className="flex items-center justify-end gap-3 mt-6 flex-wrap">
          <button onClick={() => save(false)} disabled={saving}
            className="text-sm bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-semibold hover:border-slate-300 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      )}
    </div>
  );
}
