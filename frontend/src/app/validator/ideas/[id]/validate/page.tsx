'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

const ScoreSlider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="mb-3">
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-700">{label}</span>
      <span className="font-semibold text-indigo-600">{value} / 10</span>
    </div>
    <input type="range" min={1} max={10} step={1} className="w-full accent-indigo-600"
      value={value} onChange={e => onChange(Number(e.target.value))} />
  </div>
);

const RiskRow = ({ label, prob, impact, onProb, onImpact }: any) => (
  <div className="grid grid-cols-3 gap-4 mb-3 items-center">
    <span className="text-sm text-gray-700">{label}</span>
    <div className="flex gap-1">
      {RISK_LEVELS.map(l => (
        <button type="button" key={l} onClick={() => onProb(l)}
          className={`flex-1 py-1 text-xs rounded border transition ${prob === l ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{l}</button>
      ))}
    </div>
    <div className="flex gap-1">
      {RISK_LEVELS.map(l => (
        <button type="button" key={l} onClick={() => onImpact(l)}
          className={`flex-1 py-1 text-xs rounded border transition ${impact === l ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'}`}>{l}</button>
      ))}
    </div>
  </div>
);

const defaultRisk = () => ({ probability: 'LOW', impact: 'LOW' });

export default function ValidateIdeaPage() {
  const router = useRouter();
  const params = useParams();
  const ideaId = params.id as string;

  const [idea, setIdea] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  const [marketOpp, setMarketOpp] = useState({ problemSeverity: 5, marketSize: 5, willingnessToPay: 5, marketGrowthRate: 5, competitionGap: 5 });
  const [feasibility, setFeasibility] = useState({ technicalComplexity: 5, capitalRequirement: 5, regulatoryDifficulty: 5, talentAvailability: 5, timeToLaunch: 5 });
  const [founderFit, setFounderFit] = useState({ industryKnowledge: 5, relevantExperience: 5, networkAccess: 5, passion: 5, skillAlignment: 5 });
  const [revenuePot, setRevenuePot] = useState({ pricingPower: 5, recurringRevenuePotential: 5, profitMarginPotential: 5, upsellOpportunities: 5, customerLifetimeValue: 5 });
  const [scalability, setScalability] = useState({ geographicExpansion: 5, automationPotential: 5, operationalComplexity: 5, dependenceOnFounder: 5, networkEffects: 5 });
  const [risks, setRisks] = useState({ competition: defaultRisk(), regulatory: defaultRisk(), technology: defaultRisk(), funding: defaultRisk(), marketAdoption: defaultRisk() });
  const [investorAttr, setInvestorAttr] = useState({ marketSize: 5, growthPotential: 5, scalability: 5, exitPotential: 5, defensibility: 5 });
  const [innovation, setInnovation] = useState({ uniqueness: 5, patentability: 5, competitiveAdvantage: 5, disruptionPotential: 5, defensibility: 5 });
  const [socialImpact, setSocialImpact] = useState({ jobCreation: 5, environmentalBenefit: 5, communityBenefit: 5, inclusion: 5, sustainability: 5 });
  const [customerVal, setCustomerVal] = useState({ wouldUse: false, wouldPay: false, wouldRecommend: false, solvesRealProblem: false, betterThanAlternatives: false });
  const [sharkTank, setSharkTank] = useState({ problemImportance: 5, marketSize: 5, revenuePotential: 5, executionEase: 5, scalability: 5 });
  const [startupSucc, setStartupSucc] = useState({ founderTeam: 5, marketSize: 5, productDifferentiation: 5, traction: 5, businessModel: 5, competition: 5, timing: 5, fundingReadiness: 5 });
  const [openFeedback, setOpenFeedback] = useState({ biggestStrength: '', biggestWeakness: '', suggestedImprovement: '' });

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'VALIDATOR') { router.push('/auth/login'); return; }
    Promise.all([api.getIdea(ideaId), api.checkAlreadyValidated(ideaId)])
      .then(([idea, check]) => {
        if (check.alreadyValidated) { router.push('/validator/dashboard'); return; }
        setIdea(idea);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const setRisk = (type: string, field: 'probability' | 'impact', val: string) => {
    setRisks(r => ({ ...r, [type]: { ...r[type as keyof typeof r], [field]: val } }));
  };

  const submit = async () => {
    if (!openFeedback.biggestStrength || !openFeedback.biggestWeakness || !openFeedback.suggestedImprovement) {
      setError('Please complete the open feedback section'); return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.submitValidation(ideaId, {
        marketOpportunity: marketOpp,
        feasibility,
        founderFit,
        revenuePotential: revenuePot,
        scalability,
        riskAssessment: {
          competitionProbability: risks.competition.probability,
          competitionImpact: risks.competition.impact,
          regulatoryProbability: risks.regulatory.probability,
          regulatoryImpact: risks.regulatory.impact,
          technologyProbability: risks.technology.probability,
          technologyImpact: risks.technology.impact,
          fundingProbability: risks.funding.probability,
          fundingImpact: risks.funding.impact,
          marketAdoptionProbability: risks.marketAdoption.probability,
          marketAdoptionImpact: risks.marketAdoption.impact,
        },
        investorAttractiveness: investorAttr,
        innovation,
        socialImpact,
        customerValidation: customerVal,
        sharkTank,
        startupSuccess: startupSucc,
        openFeedback,
      });
      router.push('/validator/dashboard?submitted=1');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ['Idea Overview', 'Market & Feasibility', 'Founder & Revenue', 'Scalability & Risk',
    'Investor & Innovation', 'Social & Customer', 'Shark Tank & Success', 'Open Feedback'];

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  if (error && !idea) return <div className="max-w-2xl mx-auto px-6 py-10"><div className="bg-red-50 text-red-700 rounded-lg p-4">{error}</div></div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Validate: {idea?.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{idea?.industryCategory} • Step {step + 1} of {steps.length}</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-8 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full min-w-[20px] ${i <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{steps[step]}</h2>

        {step === 0 && idea && (
          <div className="space-y-4">
            {[
              { label: 'Problem Statement', val: idea.problemStatement },
              { label: 'Solution', val: idea.solutionDescription },
              { label: 'Target Customer', val: idea.targetCustomer },
              { label: 'Revenue Model', val: idea.revenueModel },
              { label: 'Stage', val: idea.stage?.replace('_', ' ') },
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{f.label}</p>
                <p className="text-sm text-gray-800">{f.val}</p>
              </div>
            ))}
            {idea.selfAssessment && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Founder Self-Assessment</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    ['Industry Knowledge', idea.selfAssessment.industryKnowledge],
                    ['Experience', idea.selfAssessment.relevantExperience],
                    ['Network', idea.selfAssessment.networkAccess],
                    ['Passion', idea.selfAssessment.passion],
                    ['Skill Alignment', idea.selfAssessment.skillAlignment],
                  ].map(([l, v]) => (
                    <div key={l as string} className="text-center bg-indigo-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-indigo-700">{v}</div>
                      <div className="text-xs text-gray-500">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {idea.founderContext && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Why This Founder</p>
                <p className="text-sm text-gray-800">{idea.founderContext}</p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Market Opportunity (score 1–10 each)</h3>
            <ScoreSlider label="Problem Severity" value={marketOpp.problemSeverity} onChange={v => setMarketOpp({ ...marketOpp, problemSeverity: v })} />
            <ScoreSlider label="Market Size" value={marketOpp.marketSize} onChange={v => setMarketOpp({ ...marketOpp, marketSize: v })} />
            <ScoreSlider label="Customer Willingness to Pay" value={marketOpp.willingnessToPay} onChange={v => setMarketOpp({ ...marketOpp, willingnessToPay: v })} />
            <ScoreSlider label="Market Growth Rate" value={marketOpp.marketGrowthRate} onChange={v => setMarketOpp({ ...marketOpp, marketGrowthRate: v })} />
            <ScoreSlider label="Competition Gap" value={marketOpp.competitionGap} onChange={v => setMarketOpp({ ...marketOpp, competitionGap: v })} />
            <hr className="my-5" />
            <h3 className="font-medium text-gray-700 mb-3">Feasibility (higher = easier)</h3>
            <ScoreSlider label="Technical Complexity" value={feasibility.technicalComplexity} onChange={v => setFeasibility({ ...feasibility, technicalComplexity: v })} />
            <ScoreSlider label="Capital Requirement" value={feasibility.capitalRequirement} onChange={v => setFeasibility({ ...feasibility, capitalRequirement: v })} />
            <ScoreSlider label="Regulatory Difficulty" value={feasibility.regulatoryDifficulty} onChange={v => setFeasibility({ ...feasibility, regulatoryDifficulty: v })} />
            <ScoreSlider label="Talent Availability" value={feasibility.talentAvailability} onChange={v => setFeasibility({ ...feasibility, talentAvailability: v })} />
            <ScoreSlider label="Time to Launch" value={feasibility.timeToLaunch} onChange={v => setFeasibility({ ...feasibility, timeToLaunch: v })} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Founder Fit Assessment</h3>
            <ScoreSlider label="Industry Knowledge" value={founderFit.industryKnowledge} onChange={v => setFounderFit({ ...founderFit, industryKnowledge: v })} />
            <ScoreSlider label="Relevant Experience" value={founderFit.relevantExperience} onChange={v => setFounderFit({ ...founderFit, relevantExperience: v })} />
            <ScoreSlider label="Network Access" value={founderFit.networkAccess} onChange={v => setFounderFit({ ...founderFit, networkAccess: v })} />
            <ScoreSlider label="Passion / Interest" value={founderFit.passion} onChange={v => setFounderFit({ ...founderFit, passion: v })} />
            <ScoreSlider label="Skill Alignment" value={founderFit.skillAlignment} onChange={v => setFounderFit({ ...founderFit, skillAlignment: v })} />
            <hr className="my-5" />
            <h3 className="font-medium text-gray-700 mb-3">Revenue Potential</h3>
            <ScoreSlider label="Pricing Power" value={revenuePot.pricingPower} onChange={v => setRevenuePot({ ...revenuePot, pricingPower: v })} />
            <ScoreSlider label="Recurring Revenue Potential" value={revenuePot.recurringRevenuePotential} onChange={v => setRevenuePot({ ...revenuePot, recurringRevenuePotential: v })} />
            <ScoreSlider label="Profit Margin Potential" value={revenuePot.profitMarginPotential} onChange={v => setRevenuePot({ ...revenuePot, profitMarginPotential: v })} />
            <ScoreSlider label="Upselling Opportunities" value={revenuePot.upsellOpportunities} onChange={v => setRevenuePot({ ...revenuePot, upsellOpportunities: v })} />
            <ScoreSlider label="Customer Lifetime Value" value={revenuePot.customerLifetimeValue} onChange={v => setRevenuePot({ ...revenuePot, customerLifetimeValue: v })} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Scalability</h3>
            <ScoreSlider label="Geographic Expansion" value={scalability.geographicExpansion} onChange={v => setScalability({ ...scalability, geographicExpansion: v })} />
            <ScoreSlider label="Automation Potential" value={scalability.automationPotential} onChange={v => setScalability({ ...scalability, automationPotential: v })} />
            <ScoreSlider label="Operational Complexity" value={scalability.operationalComplexity} onChange={v => setScalability({ ...scalability, operationalComplexity: v })} />
            <ScoreSlider label="Dependence on Founder" value={scalability.dependenceOnFounder} onChange={v => setScalability({ ...scalability, dependenceOnFounder: v })} />
            <ScoreSlider label="Network Effects" value={scalability.networkEffects} onChange={v => setScalability({ ...scalability, networkEffects: v })} />
            <hr className="my-5" />
            <h3 className="font-medium text-gray-700 mb-3">Risk Assessment</h3>
            <div className="grid grid-cols-3 gap-4 mb-2 text-xs font-medium text-gray-500">
              <span>Risk Type</span><span>Probability</span><span>Impact</span>
            </div>
            {[
              { key: 'competition', label: 'Competition' },
              { key: 'regulatory', label: 'Regulatory' },
              { key: 'technology', label: 'Technology' },
              { key: 'funding', label: 'Funding' },
              { key: 'marketAdoption', label: 'Market Adoption' },
            ].map(r => (
              <RiskRow key={r.key} label={r.label}
                prob={(risks as any)[r.key].probability} impact={(risks as any)[r.key].impact}
                onProb={(v: string) => setRisk(r.key, 'probability', v)}
                onImpact={(v: string) => setRisk(r.key, 'impact', v)} />
            ))}
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Investor Attractiveness</h3>
            <ScoreSlider label="Market Size" value={investorAttr.marketSize} onChange={v => setInvestorAttr({ ...investorAttr, marketSize: v })} />
            <ScoreSlider label="Growth Potential" value={investorAttr.growthPotential} onChange={v => setInvestorAttr({ ...investorAttr, growthPotential: v })} />
            <ScoreSlider label="Scalability" value={investorAttr.scalability} onChange={v => setInvestorAttr({ ...investorAttr, scalability: v })} />
            <ScoreSlider label="Exit Potential" value={investorAttr.exitPotential} onChange={v => setInvestorAttr({ ...investorAttr, exitPotential: v })} />
            <ScoreSlider label="Defensibility" value={investorAttr.defensibility} onChange={v => setInvestorAttr({ ...investorAttr, defensibility: v })} />
            <hr className="my-5" />
            <h3 className="font-medium text-gray-700 mb-3">Innovation</h3>
            <ScoreSlider label="Uniqueness" value={innovation.uniqueness} onChange={v => setInnovation({ ...innovation, uniqueness: v })} />
            <ScoreSlider label="Patentability" value={innovation.patentability} onChange={v => setInnovation({ ...innovation, patentability: v })} />
            <ScoreSlider label="Competitive Advantage" value={innovation.competitiveAdvantage} onChange={v => setInnovation({ ...innovation, competitiveAdvantage: v })} />
            <ScoreSlider label="Disruption Potential" value={innovation.disruptionPotential} onChange={v => setInnovation({ ...innovation, disruptionPotential: v })} />
            <ScoreSlider label="Defensibility" value={innovation.defensibility} onChange={v => setInnovation({ ...innovation, defensibility: v })} />
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Social Impact</h3>
            <ScoreSlider label="Job Creation" value={socialImpact.jobCreation} onChange={v => setSocialImpact({ ...socialImpact, jobCreation: v })} />
            <ScoreSlider label="Environmental Benefit" value={socialImpact.environmentalBenefit} onChange={v => setSocialImpact({ ...socialImpact, environmentalBenefit: v })} />
            <ScoreSlider label="Community Benefit" value={socialImpact.communityBenefit} onChange={v => setSocialImpact({ ...socialImpact, communityBenefit: v })} />
            <ScoreSlider label="Inclusion" value={socialImpact.inclusion} onChange={v => setSocialImpact({ ...socialImpact, inclusion: v })} />
            <ScoreSlider label="Sustainability" value={socialImpact.sustainability} onChange={v => setSocialImpact({ ...socialImpact, sustainability: v })} />
            <hr className="my-5" />
            <h3 className="font-medium text-gray-700 mb-3">Customer Validation (Yes / No)</h3>
            {[
              { key: 'wouldUse', label: 'Would you use this product?' },
              { key: 'wouldPay', label: 'Would you pay for it?' },
              { key: 'wouldRecommend', label: 'Would you recommend it?' },
              { key: 'solvesRealProblem', label: 'Does it solve a real problem?' },
              { key: 'betterThanAlternatives', label: 'Is it better than current alternatives?' },
            ].map(q => (
              <div key={q.key} className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">{q.label}</span>
                <div className="flex gap-2">
                  {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(o => (
                    <button type="button" key={o.label}
                      onClick={() => setCustomerVal({ ...customerVal, [q.key]: o.val })}
                      className={`px-3 py-1 text-sm rounded border transition ${(customerVal as any)[q.key] === o.val ? (o.val ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600') : 'border-gray-300 text-gray-600'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 6 && (
          <div>
            <h3 className="font-medium text-gray-700 mb-1">Shark Tank Score</h3>
            <p className="text-xs text-gray-500 mb-3">Weighted: Problem 25%, Market 20%, Revenue 20%, Execution 15%, Scalability 20%</p>
            <ScoreSlider label="Problem Importance (25%)" value={sharkTank.problemImportance} onChange={v => setSharkTank({ ...sharkTank, problemImportance: v })} />
            <ScoreSlider label="Market Size (20%)" value={sharkTank.marketSize} onChange={v => setSharkTank({ ...sharkTank, marketSize: v })} />
            <ScoreSlider label="Revenue Potential (20%)" value={sharkTank.revenuePotential} onChange={v => setSharkTank({ ...sharkTank, revenuePotential: v })} />
            <ScoreSlider label="Execution Ease (15%)" value={sharkTank.executionEase} onChange={v => setSharkTank({ ...sharkTank, executionEase: v })} />
            <ScoreSlider label="Scalability (20%)" value={sharkTank.scalability} onChange={v => setSharkTank({ ...sharkTank, scalability: v })} />
            <hr className="my-5" />
            <h3 className="font-medium text-gray-700 mb-1">Startup Validation Score</h3>
            <p className="text-xs text-gray-500 mb-3">Weighted: Team 25% · Market 20% · Product 15% · Traction 15% · Biz Model 10% · Competition 5% · Timing 5% · Funding 5%</p>
            <ScoreSlider label="Founder / Team Quality (25%)" value={startupSucc.founderTeam} onChange={v => setStartupSucc({ ...startupSucc, founderTeam: v })} />
            <ScoreSlider label="Market Size & Opportunity (20%)" value={startupSucc.marketSize} onChange={v => setStartupSucc({ ...startupSucc, marketSize: v })} />
            <ScoreSlider label="Product Differentiation (15%)" value={startupSucc.productDifferentiation} onChange={v => setStartupSucc({ ...startupSucc, productDifferentiation: v })} />
            <ScoreSlider label="Traction & Evidence of Demand (15%)" value={startupSucc.traction} onChange={v => setStartupSucc({ ...startupSucc, traction: v })} />
            <ScoreSlider label="Business Model Strength (10%)" value={startupSucc.businessModel} onChange={v => setStartupSucc({ ...startupSucc, businessModel: v })} />
            <ScoreSlider label="Competitive Advantage (5%)" value={startupSucc.competition} onChange={v => setStartupSucc({ ...startupSucc, competition: v })} />
            <ScoreSlider label="Market Timing (5%)" value={startupSucc.timing} onChange={v => setStartupSucc({ ...startupSucc, timing: v })} />
            <ScoreSlider label="Funding Readiness (5%)" value={startupSucc.fundingReadiness} onChange={v => setStartupSucc({ ...startupSucc, fundingReadiness: v })} />
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            {[
              { key: 'biggestStrength', label: 'Biggest Strength', placeholder: 'What is the strongest aspect of this idea?' },
              { key: 'biggestWeakness', label: 'Biggest Weakness', placeholder: 'What is the most significant weakness or risk?' },
              { key: 'suggestedImprovement', label: 'One Suggested Improvement', placeholder: 'What single change would most improve this idea?' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} *</label>
                <textarea rows={3} required placeholder={f.placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={(openFeedback as any)[f.key]}
                  onChange={e => setOpenFeedback({ ...openFeedback, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-50">Back</button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700">Next</button>
          ) : (
            <button onClick={submit} disabled={submitting}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Validation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
