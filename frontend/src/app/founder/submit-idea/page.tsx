'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import ScoreSelector from '@/components/ScoreSelector';

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

  const validateTeamStep = () => {
    const filled = teamMembers.filter(m => m.name.trim() || m.linkedinUrl.trim());
    if (filled.length === 0) { setError('Add at least one team member with their LinkedIn profile'); return false; }
    const incomplete = filled.some(m => !m.name.trim() || !m.linkedinUrl.trim());
    if (incomplete) { setError('Each team member needs both a name and a LinkedIn URL'); return false; }
    setError('');
    return true;
  };

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') router.push('/auth/login');
  }, []);

  const submitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanTeam = teamMembers.filter(m => m.name.trim() && m.linkedinUrl.trim());
      const res = await api.createIdea({ ...idea, teamMembers: cleanTeam, selfAssessment: assessment });
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

  if (paySuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Idea Submitted!</h2>
          <p className="text-slate-500 mb-6">Your idea is now live for validators to review. Your dashboard unlocks after 3 expert validations or 48 hours — whichever comes first.</p>
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
        <h1 className="text-3xl font-bold text-slate-900">Submit Your Business Idea</h1>
        <p className="text-slate-500 mt-1">Complete all sections to get expert validation</p>
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
        <form onSubmit={e => { e.preventDefault(); if (validateTeamStep()) setStep('assessment'); }} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pitch Video URL *</label>
            <input required type="url" placeholder="https://youtube.com/... or https://loom.com/..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={idea.videoUrl} onChange={e => setIdea({ ...idea, videoUrl: e.target.value })} />
            <p className="text-xs text-slate-500 mt-1">A short video (YouTube, Loom, Vimeo) introducing your idea. Validators watch this first.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team *</label>
            <p className="text-xs text-slate-500 mb-2">Everyone involved, with their LinkedIn profile.</p>
            <div className="space-y-2">
              {teamMembers.map((member, i) => (
                <div key={i} className="flex gap-2">
                  <input required={i === 0} placeholder="Name"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={member.name} onChange={e => updateTeamMember(i, 'name', e.target.value)} />
                  <input required={i === 0} type="url" placeholder="LinkedIn URL"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={member.linkedinUrl} onChange={e => updateTeamMember(i, 'linkedinUrl', e.target.value)} />
                  {teamMembers.length > 1 && (
                    <button type="button" onClick={() => removeTeamMember(i)}
                      className="px-3 text-slate-400 hover:text-red-500 text-sm">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addTeamMember} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
              + Add team member
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Idea Title *</label>
            <input required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={idea.title} onChange={e => setIdea({ ...idea, title: e.target.value })} />
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
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <textarea rows={f.rows} placeholder={f.placeholder}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={(idea as any)[f.key]}
                onChange={e => setIdea({ ...idea, [f.key]: e.target.value })}
                required={!f.label.includes('Optional')} />
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

      {/* Step 3: Payment */}
      {step === 'payment' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="text-4xl mb-4">💳</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Complete Payment</h2>
          <p className="text-slate-500 mb-6">A small fee is charged to publish your idea for validation.</p>
          <div className="bg-slate-50 rounded-xl p-6 mb-6 inline-block">
            <div className="text-3xl font-black text-slate-900">$9.99</div>
            <div className="text-sm text-slate-500 mt-1">One-time submission fee</div>
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
