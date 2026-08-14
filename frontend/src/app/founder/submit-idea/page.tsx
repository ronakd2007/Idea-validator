'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser, isViewMode } from '@/lib/auth';
import ScoreSelector from '@/components/ScoreSelector';
import { FieldErrors, fieldClass, isUrl, requireText, scrollToFirstError, summaryMessage } from '@/lib/formValidation';
import { AssumptionEditor } from '@/components/founder/AssumptionCheckCard';
import type { Assumption } from '@/lib/assumptionCheck';

const STAGES = ['IDEA', 'RESEARCH', 'PROTOTYPE', 'MVP', 'REVENUE_GENERATING'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce',
  'Food & Beverage', 'Real Estate', 'Media & Entertainment', 'Sustainability', 'Other'];

export default function SubmitIdeaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>}>
      <SubmitIdeaInner />
    </Suspense>
  );
}

function SubmitIdeaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payIdeaId = searchParams.get('pay');
  // Revision flow: prefill from an existing idea and submit through the
  // existing /ideas/:id/revise endpoint (discounted resubmission).
  const reviseIdeaId = searchParams.get('revise');

  const [step, setStep] = useState<'idea' | 'assessment' | 'payment'>(payIdeaId ? 'payment' : 'idea');
  const [createdIdeaId, setCreatedIdeaId] = useState<string | null>(payIdeaId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const [idea, setIdea] = useState({
    title: '', videoUrl: '', industryCategory: INDUSTRIES[0], problemStatement: '',
    solutionDescription: '', targetCustomer: '', revenueModel: '', stage: STAGES[0],
    founderContext: '',
  });

  const [teamMembers, setTeamMembers] = useState([{ name: '', linkedinUrl: '' }]);

  const [assessment, setAssessment] = useState({
    industryKnowledge: 5, relevantExperience: 5, networkAccess: 5, passion: 5, skillAlignment: 5,
  });

  const updateTeamMember = (index: number, field: 'name' | 'linkedinUrl', value: string) => {
    setTeamMembers(tm => tm.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const addTeamMember = () => setTeamMembers(tm => [...tm, { name: '', linkedinUrl: '' }]);

  const removeTeamMember = (index: number) => setTeamMembers(tm => tm.filter((_, i) => i !== index));

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Field lengths mirror the backend CreateIdeaDto exactly, so nothing that
  // passes here can bounce off the server later.
  const validateIdeaStep = (): boolean => {
    const errors: FieldErrors = {};

    if (!idea.videoUrl.trim()) errors.videoUrl = 'Pitch video URL is required.';
    else if (!isUrl(idea.videoUrl)) errors.videoUrl = 'Enter a full video link starting with https:// (YouTube, Loom, Vimeo…).';

    const filled = teamMembers.filter(m => m.name.trim() || m.linkedinUrl.trim());
    if (filled.length === 0) {
      errors.team = 'Add at least one team member with their name and LinkedIn profile.';
    } else {
      teamMembers.forEach((m, i) => {
        if (!m.name.trim() && !m.linkedinUrl.trim()) return; // fully empty extra row is fine
        if (!m.name.trim()) errors[`team-${i}`] = `Team member ${i + 1} is missing a name.`;
        else if (!m.linkedinUrl.trim()) errors[`team-${i}`] = `Team member ${i + 1} is missing their LinkedIn URL.`;
        else if (!isUrl(m.linkedinUrl)) errors[`team-${i}`] = `Team member ${i + 1}'s LinkedIn URL must start with https://.`;
      });
    }

    const title = requireText(idea.title, 'Idea title', 2);
    if (title) errors.title = title;
    const problem = requireText(idea.problemStatement, 'Problem statement', 10);
    if (problem) errors.problemStatement = problem;
    const solution = requireText(idea.solutionDescription, 'Solution description', 10);
    if (solution) errors.solutionDescription = solution;
    const target = requireText(idea.targetCustomer, 'Target customer', 2);
    if (target) errors.targetCustomer = target;
    const revenue = requireText(idea.revenueModel, 'Revenue model', 2);
    if (revenue) errors.revenueModel = revenue;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(summaryMessage(errors));
      scrollToFirstError(errors);
      return false;
    }
    setError('');
    return true;
  };

  const clearFieldError = (key: string) => {
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const [viewMode, setViewMode] = useState(false);
  // Assumption Checker — entirely optional; empty array is a normal submission.
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [assumptionEditorOpen, setAssumptionEditorOpen] = useState(false);
  // The fee is charged server-side from IDEA_SUBMISSION_FEE — this display
  // reads the same config so the screen can never show a different number.
  const [fee, setFee] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') router.push('/auth/login');
    setViewMode(isViewMode());
    api.getPaymentConfig().then((c) => setFee(Number(c.fee) || null)).catch(() => {});
  }, []);

  // Prefill the whole form from the idea being revised — the founder edits
  // what changed instead of retyping everything.
  useEffect(() => {
    if (!reviseIdeaId) return;
    api.getIdea(reviseIdeaId)
      .then((original: any) => {
        setIdea({
          title: original.title || '',
          videoUrl: original.videoUrl || '',
          industryCategory: original.industryCategory || INDUSTRIES[0],
          problemStatement: original.problemStatement || '',
          solutionDescription: original.solutionDescription || '',
          targetCustomer: original.targetCustomer || '',
          revenueModel: original.revenueModel || '',
          stage: original.stage || STAGES[0],
          founderContext: original.founderContext || '',
        });
        try {
          const team = JSON.parse(original.teamMembers || '[]');
          if (Array.isArray(team) && team.length) setTeamMembers(team);
        } catch { /* keep the empty row */ }
        try {
          const asm = JSON.parse(original.assumptions || '[]');
          if (Array.isArray(asm)) setAssumptions(asm.filter((x: any) => x?.statement));
        } catch { /* no assumptions */ }
        if (original.selfAssessment) {
          const sa = original.selfAssessment;
          setAssessment({
            industryKnowledge: sa.industryKnowledge ?? 5,
            relevantExperience: sa.relevantExperience ?? 5,
            networkAccess: sa.networkAccess ?? 5,
            passion: sa.passion ?? 5,
            skillAlignment: sa.skillAlignment ?? 5,
          });
        }
      })
      .catch(() => setError('Could not load the idea to revise.'));
  }, [reviseIdeaId]);

  const submitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanTeam = teamMembers.filter(m => m.name.trim() && m.linkedinUrl.trim());
      const payload = { ...idea, teamMembers: cleanTeam, selfAssessment: assessment, assumptions };
      const res = reviseIdeaId
        ? await api.reviseIdea(reviseIdeaId, payload)
        : await api.createIdea(payload);
      setCreatedIdeaId(res.id);
      setStep('payment');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completePayment = async () => {
    if (!createdIdeaId) return;
    setLoading(true);
    try {
      await api.mockPayment(createdIdeaId);
      setPaySuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const SliderField = ({ label, field }: { label: string; field: keyof typeof assessment }) => (
    <ScoreSelector
      label={label}
      value={assessment[field]}
      onChange={(v) => setAssessment({ ...assessment, [field]: v })}
    />
  );

  // Read-only in View-as-User mode: submitting an idea or paying on the
  // viewed founder's behalf must be impossible, not just discouraged. The
  // backend refuses these writes too — this is the friendly layer.
  if (viewMode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 w-full max-w-md text-center">
          <div className="text-4xl mb-4">👁</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Read-only view</h2>
          <p className="text-slate-600 text-sm">This action is disabled while viewing as another user.</p>
        </div>
      </div>
    );
  }

  if (paySuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Idea Submitted!</h2>
          <p className="text-slate-500 mb-6">Your idea is now live for validators to review. Your dashboard is available right away — expert validations will appear there as they come in.</p>
          <button onClick={() => router.push('/founder/ideas')}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700">
            View My Ideas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{reviseIdeaId ? 'Improve & Re-validate' : 'Submit Your Business Idea'}</h1>
        <p className="text-slate-500 mt-1">
          {reviseIdeaId
            ? 'Update what changed since the last validation — revised versions are submitted at a discount.'
            : 'Complete all sections to get expert validation'}
        </p>
      </div>

      {/* Steps indicator */}
      {!payIdeaId && (
        <div className="flex items-center mb-8 gap-2">
          {[{ id: 'idea', label: '1. Idea Details' }, { id: 'assessment', label: '2. Self Assessment' }, { id: 'payment', label: '3. Payment' }].map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${step === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{s.label}</div>
              {i < 2 && <div className="w-6 h-px bg-slate-200" />}
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>}

      {/* Step 1: Idea */}
      {step === 'idea' && (
        <form noValidate onSubmit={e => { e.preventDefault(); if (validateIdeaStep()) { setStep('assessment'); window.scrollTo({ top: 0 }); } }} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div id="field-videoUrl">
            <label className="block text-sm font-medium text-slate-700 mb-1">Pitch Video URL *</label>
            <input type="url" placeholder="https://youtube.com/... or https://loom.com/..."
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors.videoUrl)}`}
              value={idea.videoUrl} onChange={e => { setIdea({ ...idea, videoUrl: e.target.value }); clearFieldError('videoUrl'); }} />
            {fieldErrors.videoUrl
              ? <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.videoUrl}</p>
              : <p className="text-xs text-slate-500 mt-1">A short video (YouTube, Loom, Vimeo) introducing your idea. Validators watch this first.</p>}
          </div>

          <div id="field-team">
            <label className="block text-sm font-medium text-slate-700 mb-1">Team *</label>
            <p className="text-xs text-slate-500 mb-2">Everyone involved, with their LinkedIn profile.</p>
            <div className="space-y-2">
              {teamMembers.map((member, i) => (
                <div key={i} id={`field-team-${i}`}>
                  <div className="flex gap-2">
                    <input placeholder="Name"
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors[`team-${i}`] || !!fieldErrors.team)}`}
                      value={member.name} onChange={e => { updateTeamMember(i, 'name', e.target.value); clearFieldError(`team-${i}`); clearFieldError('team'); }} />
                    <input type="url" placeholder="LinkedIn URL"
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors[`team-${i}`] || !!fieldErrors.team)}`}
                      value={member.linkedinUrl} onChange={e => { updateTeamMember(i, 'linkedinUrl', e.target.value); clearFieldError(`team-${i}`); clearFieldError('team'); }} />
                    {teamMembers.length > 1 && (
                      <button type="button" onClick={() => removeTeamMember(i)}
                        className="px-3 text-slate-400 hover:text-red-500 text-sm">✕</button>
                    )}
                  </div>
                  {fieldErrors[`team-${i}`] && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors[`team-${i}`]}</p>}
                </div>
              ))}
            </div>
            {fieldErrors.team && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.team}</p>}
            <button type="button" onClick={addTeamMember} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
              + Add team member
            </button>
          </div>

          <div id="field-title">
            <label className="block text-sm font-medium text-slate-700 mb-1">Idea Title *</label>
            <input className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${fieldClass(!!fieldErrors.title)}`}
              value={idea.title} onChange={e => { setIdea({ ...idea, title: e.target.value }); clearFieldError('title'); }} />
            {fieldErrors.title && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.title}</p>}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry Category *</label>
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={idea.industryCategory} onChange={e => setIdea({ ...idea, industryCategory: e.target.value })}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Stage *</label>
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={idea.stage} onChange={e => setIdea({ ...idea, stage: e.target.value })}>
                {STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          {[
            { key: 'problemStatement', label: 'Problem Statement *', rows: 3, placeholder: 'What problem does your idea solve?' },
            { key: 'solutionDescription', label: 'Solution Description *', rows: 3, placeholder: 'How does your idea solve the problem?' },
            { key: 'targetCustomer', label: 'Target Customer *', rows: 2, placeholder: 'Who is your ideal customer?' },
            { key: 'revenueModel', label: 'Revenue Model *', rows: 2, placeholder: 'How will you make money?' },
            { key: 'founderContext', label: 'Why are you the right person to build this? (Optional)', rows: 3, placeholder: '' },
          ].map(f => (
            <div key={f.key} id={`field-${f.key}`}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <textarea rows={f.rows} placeholder={f.placeholder}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 resize-none ${fieldClass(!!fieldErrors[f.key])}`}
                value={(idea as any)[f.key]}
                onChange={e => { setIdea({ ...idea, [f.key]: e.target.value }); clearFieldError(f.key); }} />
              {fieldErrors[f.key] && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors[f.key]}</p>}
            </div>
          ))}
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700">
            Next: Self Assessment
          </button>
        </form>
      )}

      {/* Step 2: Assessment */}
      {step === 'assessment' && (
        <form onSubmit={submitIdea} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Founder Fit Self Assessment</h2>
          <p className="text-sm text-slate-500 mb-6">Rate yourself honestly. Validators will compare against their own assessment.</p>
          <SliderField label="Industry Knowledge" field="industryKnowledge" />
          <SliderField label="Relevant Experience" field="relevantExperience" />
          <SliderField label="Network Access" field="networkAccess" />
          <SliderField label="Passion / Interest" field="passion" />
          <SliderField label="Skill Alignment" field="skillAlignment" />

          {/* Assumption Checker — entirely optional. Skipping is a first-class
              choice, not a validation error. */}
          <div className="border-t border-slate-100 mt-6 pt-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Define Your Assumptions <span className="text-xs font-normal text-slate-400">(optional)</span></h3>
                <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                  List things you believe must be true for your idea to succeed. We&apos;ll test these beliefs against your validation evidence.
                </p>
              </div>
              <button type="button" onClick={() => setAssumptionEditorOpen(true)}
                className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-50 shrink-0">
                {assumptions.length ? `Edit assumptions (${assumptions.length})` : '+ Add Assumptions'}
              </button>
            </div>
            {assumptions.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {assumptions.map((asm, i) => (
                  <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-slate-300">•</span>“{asm.statement}”</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 mt-2">Skip for now — you can also add assumptions later from your idea&apos;s dashboard.</p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setStep('idea')}
              className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-50">Back</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Next: Payment'}
            </button>
          </div>
        </form>
      )}

      {assumptionEditorOpen && (
        <AssumptionEditor
          initial={assumptions}
          draftMode
          draft={idea}
          onDraftChange={setAssumptions}
          onClose={() => setAssumptionEditorOpen(false)}
        />
      )}

      {/* Step 3: Payment */}
      {step === 'payment' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="text-4xl mb-4">💳</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Complete Payment</h2>
          <p className="text-slate-500 mb-6">A small fee is charged to publish your idea for validation.</p>
          <div className="bg-slate-50 rounded-xl p-6 mb-6 inline-block">
            <div className="text-3xl font-black text-slate-900">
              {/* Fee is stored in cents (2999 = $29.99), matching Payment.currency USD. */}
              {fee != null
                ? `$${((reviseIdeaId ? Math.round(fee * 0.4) : fee) / 100).toFixed(2)}`
                : '…'}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {reviseIdeaId ? 'Revision fee — 60% off the standard submission' : 'One-time submission fee'}
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-6">Currently in test mode — payment is simulated for demo purposes.</p>
          <button onClick={completePayment} disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Processing...' : 'Complete Payment (Test Mode)'}
          </button>
        </div>
      )}
    </div>
  );
}
