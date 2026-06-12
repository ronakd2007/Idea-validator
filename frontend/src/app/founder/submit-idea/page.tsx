'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

const STAGES = ['IDEA', 'RESEARCH', 'PROTOTYPE', 'MVP', 'REVENUE_GENERATING'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce',
  'Food & Beverage', 'Real Estate', 'Media & Entertainment', 'Sustainability', 'Other'];

export default function SubmitIdeaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
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
    title: '', industryCategory: INDUSTRIES[0], problemStatement: '',
    solutionDescription: '', targetCustomer: '', revenueModel: '', stage: STAGES[0],
    founderContext: '',
  });

  const [assessment, setAssessment] = useState({
    industryKnowledge: 5, relevantExperience: 5, networkAccess: 5, passion: 5, skillAlignment: 5,
  });

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') router.push('/auth/login');
  }, []);

  const submitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.createIdea({ ...idea, selfAssessment: assessment });
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
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold text-indigo-600">{assessment[field]} / 10</span>
      </div>
      <input type="range" min={1} max={10} step={1}
        className="w-full accent-indigo-600"
        value={assessment[field]}
        onChange={e => setAssessment({ ...assessment, [field]: Number(e.target.value) })} />
    </div>
  );

  if (paySuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-10 w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Idea Submitted!</h2>
          <p className="text-gray-500 mb-6">Your idea is now live for validators to review. Your dashboard will be available in 48 hours.</p>
          <button onClick={() => router.push('/founder/ideas')}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700">
            View My Ideas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Submit Your Business Idea</h1>
        <p className="text-gray-500 mt-1">Complete all sections to get expert validation</p>
      </div>

      {/* Steps indicator */}
      {!payIdeaId && (
        <div className="flex items-center mb-8 gap-2">
          {[{ id: 'idea', label: '1. Idea Details' }, { id: 'assessment', label: '2. Self Assessment' }, { id: 'payment', label: '3. Payment' }].map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${step === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{s.label}</div>
              {i < 2 && <div className="w-6 h-px bg-gray-300" />}
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>}

      {/* Step 1: Idea */}
      {step === 'idea' && (
        <form onSubmit={e => { e.preventDefault(); setStep('assessment'); }} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Idea Title *</label>
            <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={idea.title} onChange={e => setIdea({ ...idea, title: e.target.value })} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry Category *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={idea.industryCategory} onChange={e => setIdea({ ...idea, industryCategory: e.target.value })}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stage *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <textarea rows={f.rows} placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                value={(idea as any)[f.key]}
                onChange={e => setIdea({ ...idea, [f.key]: e.target.value })}
                required={!f.label.includes('Optional')} />
            </div>
          ))}
          <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700">
            Next: Self Assessment
          </button>
        </form>
      )}

      {/* Step 2: Assessment */}
      {step === 'assessment' && (
        <form onSubmit={submitIdea} className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Founder Fit Self Assessment</h2>
          <p className="text-sm text-gray-500 mb-6">Rate yourself honestly. Validators will compare against their own assessment.</p>
          <SliderField label="Industry Knowledge" field="industryKnowledge" />
          <SliderField label="Relevant Experience" field="relevantExperience" />
          <SliderField label="Network Access" field="networkAccess" />
          <SliderField label="Passion / Interest" field="passion" />
          <SliderField label="Skill Alignment" field="skillAlignment" />
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setStep('idea')}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-50">Back</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Next: Payment'}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Payment */}
      {step === 'payment' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-4xl mb-4">💳</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Complete Payment</h2>
          <p className="text-gray-500 mb-6">A small fee is charged to publish your idea for validation.</p>
          <div className="bg-gray-50 rounded-xl p-6 mb-6 inline-block">
            <div className="text-3xl font-black text-gray-900">$9.99</div>
            <div className="text-sm text-gray-500 mt-1">One-time submission fee</div>
          </div>
          <p className="text-xs text-gray-400 mb-6">Currently in test mode — payment is simulated for demo purposes.</p>
          <button onClick={completePayment} disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Processing...' : 'Complete Payment (Test Mode)'}
          </button>
        </div>
      )}
    </div>
  );
}
