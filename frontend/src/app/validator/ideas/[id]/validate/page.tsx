'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import ScoreSelector from '@/components/ScoreSelector';
import FrameworkOverviewPanel from '@/components/validator/FrameworkOverviewPanel';
import { FRAMEWORKS } from '@/lib/frameworks';

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

const RiskRow = ({ label, prob, impact, onProb, onImpact }: any) => (
  // Stacks on phones: three 33px-wide buttons per column can't fit the word
  // "MEDIUM" side by side at 390px — each selector gets a labeled full-width
  // row instead. The 3-column matrix returns at sm.
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-4 mb-5 sm:mb-3 sm:items-center">
    <span className="text-sm text-slate-700 font-medium sm:font-normal">{label}</span>
    <div className="flex gap-1 items-center">
      <span className="sm:hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 w-16 shrink-0">Probability</span>
      {RISK_LEVELS.map(l => (
        <button type="button" key={l} onClick={() => onProb(l)}
          className={`flex-1 py-1 text-xs rounded border transition ${prob === l ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-500'}`}>{l}</button>
      ))}
    </div>
    <div className="flex gap-1 items-center">
      <span className="sm:hidden text-[10px] font-medium uppercase tracking-wide text-slate-400 w-16 shrink-0">Impact</span>
      {RISK_LEVELS.map(l => (
        <button type="button" key={l} onClick={() => onImpact(l)}
          className={`flex-1 py-1 text-xs rounded border transition ${impact === l ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 text-slate-500'}`}>{l}</button>
      ))}
    </div>
  </div>
);

const defaultRisk = () => ({ probability: 'LOW', impact: 'LOW' });

const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

const weightedShark = (st: any) =>
  (st.problemImportance / 10) * 25 + (st.marketSize / 10) * 20 + (st.revenuePotential / 10) * 20 +
  (st.executionEase / 10) * 15 + (st.scalability / 10) * 20;

const weightedStartup = (ss: any) =>
  (ss.founderTeam / 10) * 25 + (ss.marketSize / 10) * 20 + (ss.productDifferentiation / 10) * 15 +
  (ss.traction / 10) * 15 + (ss.businessModel / 10) * 10 + (ss.competition / 10) * 5 +
  (ss.timing / 10) * 5 + (ss.fundingReadiness / 10) * 5;

function scoreBadge(average: number | null) {
  if (average == null) return null;
  if (average >= 8) return { label: 'Strong', color: 'text-emerald-600 bg-emerald-50' };
  if (average >= 5) return { label: 'Average', color: 'text-blue-600 bg-blue-50' };
  if (average >= 3) return { label: 'Weak', color: 'text-amber-600 bg-amber-50' };
  return { label: 'Critical', color: 'text-red-600 bg-red-50' };
}

export default function ValidateIdeaPage() {
  const router = useRouter();
  const params = useParams();
  const ideaId = params.id as string;
  const draftKey = `iv_validate_draft_${ideaId}`;

  const [idea, setIdea] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

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
  const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({});

  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'VALIDATOR') { router.push('/auth/login'); return; }
    setViewMode(!!(user as any).viewAs);
    Promise.all([api.getIdea(ideaId), api.checkAlreadyValidated(ideaId)])
      .then(([idea, check]) => {
        if (check.alreadyValidated) { router.push('/validator/dashboard'); return; }
        setIdea(idea);

        // restore a locally-saved draft, if one exists for this idea —
        // nothing here touches the server, this is browser-only persistence
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.marketOpp) setMarketOpp(d.marketOpp);
            if (d.feasibility) setFeasibility(d.feasibility);
            if (d.founderFit) setFounderFit(d.founderFit);
            if (d.revenuePot) setRevenuePot(d.revenuePot);
            if (d.scalability) setScalability(d.scalability);
            if (d.risks) setRisks(d.risks);
            if (d.investorAttr) setInvestorAttr(d.investorAttr);
            if (d.innovation) setInnovation(d.innovation);
            if (d.socialImpact) setSocialImpact(d.socialImpact);
            if (d.customerVal) setCustomerVal(d.customerVal);
            if (d.sharkTank) setSharkTank(d.sharkTank);
            if (d.startupSucc) setStartupSucc(d.startupSucc);
            if (d.openFeedback) setOpenFeedback(d.openFeedback);
            if (typeof d.step === 'number') setStep(d.step);
            setDraftRestored(true);
          }
        } catch {
          // corrupted draft — ignore and start fresh
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const setRisk = (type: string, field: 'probability' | 'impact', val: string) => {
    setRisks(r => ({ ...r, [type]: { ...r[type as keyof typeof r], [field]: val } }));
  };

  const saveDraft = () => {
    localStorage.setItem(draftKey, JSON.stringify({
      marketOpp, feasibility, founderFit, revenuePot, scalability, risks,
      investorAttr, innovation, socialImpact, customerVal, sharkTank, startupSucc, openFeedback, step,
    }));
    setDraftSavedAt(Date.now());
    setTimeout(() => setDraftSavedAt(null), 2000);
  };

  const submit = async () => {
    if (viewMode) {
      setError('This action is disabled while viewing as another user.');
      return;
    }
    // Field-level checks: name exactly which feedback boxes are missing and
    // scroll the first one into view rather than one vague banner.
    const fbLabels: Record<string, string> = {
      biggestStrength: 'Biggest Strength',
      biggestWeakness: 'Biggest Weakness',
      suggestedImprovement: 'One Suggested Improvement',
    };
    const fbErrors: Record<string, string> = {};
    for (const [key, label] of Object.entries(fbLabels)) {
      if (!(openFeedback as any)[key]?.trim()) fbErrors[key] = `"${label}" is required — a few honest sentences are enough.`;
    }
    setFeedbackErrors(fbErrors);
    if (Object.keys(fbErrors).length > 0) {
      setError(Object.keys(fbErrors).length === 1 ? 'Please fill the highlighted feedback field.' : `Please fill the ${Object.keys(fbErrors).length} highlighted feedback fields.`);
      document.getElementById(`field-${Object.keys(fbErrors)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
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
      localStorage.removeItem(draftKey);
      router.push('/validator/dashboard?submitted=1');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ['Idea Overview', 'Market & Feasibility', 'Founder & Revenue', 'Scalability & Risk',
    'Investor & Innovation', 'Social & Customer', 'Shark Tank & Success', 'Open Feedback'];

  // this step's live average (1-10) — cosmetic only, submission payload is unchanged
  const stepValues: number[] = (() => {
    switch (step) {
      case 1: return [...Object.values(marketOpp), ...Object.values(feasibility)];
      case 2: return [...Object.values(founderFit), ...Object.values(revenuePot)];
      case 3: return [...Object.values(scalability)];
      case 4: return [...Object.values(investorAttr), ...Object.values(innovation)];
      case 5: return [...Object.values(socialImpact)];
      case 6: return [...Object.values(sharkTank), ...Object.values(startupSucc)];
      default: return [];
    }
  })();
  const stepAverage = avg(stepValues);
  const badge = scoreBadge(stepAverage);

  // scores for the framework overview panel — only for steps already passed
  const frameworkScores: Record<string, number | null> = {
    'Market Opportunity': step > 1 ? sum(marketOpp) : null,
    'Feasibility': step > 1 ? sum(feasibility) : null,
    'Founder Fit': step > 2 ? sum(founderFit) : null,
    'Revenue Potential': step > 2 ? sum(revenuePot) : null,
    'Scalability': step > 3 ? sum(scalability) : null,
    'Investor Attractiveness': step > 4 ? sum(investorAttr) : null,
    'Innovation': step > 4 ? sum(innovation) : null,
    'Social Impact': step > 5 ? sum(socialImpact) : null,
    'Shark Tank Score': step > 6 ? weightedShark(sharkTank) : null,
    'Startup Success': step > 6 ? weightedStartup(startupSucc) : null,
  };

  const passedValues: number[] = [
    ...(step > 1 ? [...Object.values(marketOpp), ...Object.values(feasibility)] : []),
    ...(step > 2 ? [...Object.values(founderFit), ...Object.values(revenuePot)] : []),
    ...(step > 3 ? Object.values(scalability) : []),
    ...(step > 4 ? [...Object.values(investorAttr), ...Object.values(innovation)] : []),
    ...(step > 5 ? Object.values(socialImpact) : []),
    ...(step > 6 ? [...Object.values(sharkTank), ...Object.values(startupSucc)] : []),
  ];
  const overallAverage = avg(passedValues) ?? 0;
  const completedFrameworksCount = FRAMEWORKS.filter(f => f.stepIndex < step).length;

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">Loading...</div>;
  if (error && !idea) return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10"><div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">{error}</div></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Validate: {idea?.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{idea?.industryCategory} • Step {step + 1} of {steps.length}</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">In Progress</span>
      </div>

      {draftRestored && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 mb-4 text-sm flex items-center justify-between">
          <span>Restored your saved draft from earlier.</span>
          <button onClick={() => setDraftRestored(false)} className="text-blue-500 hover:text-blue-700">✕</button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0">
          {/* Progress */}
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{Math.round((step / (steps.length - 1)) * 100)}% Complete</span>
          </div>
          <div className="flex gap-1 mb-8 overflow-x-auto">
            {steps.map((s, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full min-w-[20px] ${i <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />
            ))}
          </div>

          {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">{steps[step]}</h2>
              {badge && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>
                  {stepAverage!.toFixed(1)} / 10 — {badge.label}
                </span>
              )}
            </div>

            {step === 0 && idea && (
              <div className="space-y-4">
                {idea.videoUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Pitch Video</p>
                    <a href={idea.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                      ▶ {idea.videoUrl}
                    </a>
                  </div>
                )}
                {idea.teamMembers && JSON.parse(idea.teamMembers).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Team</p>
                    <div className="space-y-1.5">
                      {JSON.parse(idea.teamMembers).map((m: { name: string; linkedinUrl: string }, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-slate-800 font-medium">{m.name}</span>
                          <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 hover:underline text-xs break-all">
                            {m.linkedinUrl}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {[
                  { label: 'Problem Statement', val: idea.problemStatement },
                  { label: 'Solution', val: idea.solutionDescription },
                  { label: 'Target Customer', val: idea.targetCustomer },
                  { label: 'Revenue Model', val: idea.revenueModel },
                  { label: 'Stage', val: idea.stage?.replace('_', ' ') },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{f.label}</p>
                    <p className="text-sm text-slate-800">{f.val}</p>
                  </div>
                ))}
                {idea.selfAssessment && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Founder Self-Assessment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        ['Industry Knowledge', idea.selfAssessment.industryKnowledge],
                        ['Experience', idea.selfAssessment.relevantExperience],
                        ['Network', idea.selfAssessment.networkAccess],
                        ['Passion', idea.selfAssessment.passion],
                        ['Skill Alignment', idea.selfAssessment.skillAlignment],
                      ].map(([l, v]) => (
                        <div key={l as string} className="text-center bg-blue-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-blue-700">{v}</div>
                          <div className="text-xs text-slate-500">{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {idea.founderContext && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Why This Founder</p>
                    <p className="text-sm text-slate-800">{idea.founderContext}</p>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <h3 className="font-medium text-slate-800 mb-3">Market Opportunity</h3>
                <ScoreSelector label="Problem Severity" description="How severe and urgent is the problem this idea solves?" value={marketOpp.problemSeverity} onChange={v => setMarketOpp({ ...marketOpp, problemSeverity: v })} />
                <ScoreSelector label="Market Size" value={marketOpp.marketSize} onChange={v => setMarketOpp({ ...marketOpp, marketSize: v })} />
                <ScoreSelector label="Customer Willingness to Pay" value={marketOpp.willingnessToPay} onChange={v => setMarketOpp({ ...marketOpp, willingnessToPay: v })} />
                <ScoreSelector label="Market Growth Rate" value={marketOpp.marketGrowthRate} onChange={v => setMarketOpp({ ...marketOpp, marketGrowthRate: v })} />
                <ScoreSelector label="Competition Gap" value={marketOpp.competitionGap} onChange={v => setMarketOpp({ ...marketOpp, competitionGap: v })} />
                <hr className="my-5 border-slate-200" />
                <h3 className="font-medium text-slate-800 mb-3">Feasibility (higher = easier to execute)</h3>
                {/* These three are inverted metrics — a high score means the
                    hurdle is SMALL. The anchors spell that out because the
                    default "Very Weak → Excellent" pair reads backwards here
                    and quietly corrupted the aggregate. */}
                <ScoreSelector label="Technical Complexity" description="10 = simple to build, 1 = highly complex" lowLabel="Highly complex" highLabel="Simple to build" value={feasibility.technicalComplexity} onChange={v => setFeasibility({ ...feasibility, technicalComplexity: v })} />
                <ScoreSelector label="Capital Requirement" description="10 = needs little capital, 1 = capital heavy" lowLabel="Capital heavy" highLabel="Low capital" value={feasibility.capitalRequirement} onChange={v => setFeasibility({ ...feasibility, capitalRequirement: v })} />
                <ScoreSelector label="Regulatory Difficulty" description="10 = few regulatory hurdles, 1 = heavily regulated" lowLabel="Heavily regulated" highLabel="Few hurdles" value={feasibility.regulatoryDifficulty} onChange={v => setFeasibility({ ...feasibility, regulatoryDifficulty: v })} />
                <ScoreSelector label="Talent Availability" lowLabel="Scarce talent" highLabel="Talent abundant" value={feasibility.talentAvailability} onChange={v => setFeasibility({ ...feasibility, talentAvailability: v })} />
                <ScoreSelector label="Time to Launch" description="10 = could launch quickly, 1 = years away" lowLabel="Years away" highLabel="Launch quickly" value={feasibility.timeToLaunch} onChange={v => setFeasibility({ ...feasibility, timeToLaunch: v })} />
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="font-medium text-slate-800 mb-3">Founder Fit Assessment</h3>
                <ScoreSelector label="Industry Knowledge" value={founderFit.industryKnowledge} onChange={v => setFounderFit({ ...founderFit, industryKnowledge: v })} />
                <ScoreSelector label="Relevant Experience" value={founderFit.relevantExperience} onChange={v => setFounderFit({ ...founderFit, relevantExperience: v })} />
                <ScoreSelector label="Network Access" value={founderFit.networkAccess} onChange={v => setFounderFit({ ...founderFit, networkAccess: v })} />
                <ScoreSelector label="Passion / Interest" value={founderFit.passion} onChange={v => setFounderFit({ ...founderFit, passion: v })} />
                <ScoreSelector label="Skill Alignment" value={founderFit.skillAlignment} onChange={v => setFounderFit({ ...founderFit, skillAlignment: v })} />
                <hr className="my-5 border-slate-200" />
                <h3 className="font-medium text-slate-800 mb-3">Revenue Potential</h3>
                <ScoreSelector label="Pricing Power" value={revenuePot.pricingPower} onChange={v => setRevenuePot({ ...revenuePot, pricingPower: v })} />
                <ScoreSelector label="Recurring Revenue Potential" value={revenuePot.recurringRevenuePotential} onChange={v => setRevenuePot({ ...revenuePot, recurringRevenuePotential: v })} />
                <ScoreSelector label="Profit Margin Potential" value={revenuePot.profitMarginPotential} onChange={v => setRevenuePot({ ...revenuePot, profitMarginPotential: v })} />
                <ScoreSelector label="Upselling Opportunities" value={revenuePot.upsellOpportunities} onChange={v => setRevenuePot({ ...revenuePot, upsellOpportunities: v })} />
                <ScoreSelector label="Customer Lifetime Value" value={revenuePot.customerLifetimeValue} onChange={v => setRevenuePot({ ...revenuePot, customerLifetimeValue: v })} />
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="font-medium text-slate-800 mb-3">Scalability (higher = scales better)</h3>
                <ScoreSelector label="Geographic Expansion" value={scalability.geographicExpansion} onChange={v => setScalability({ ...scalability, geographicExpansion: v })} />
                <ScoreSelector label="Automation Potential" value={scalability.automationPotential} onChange={v => setScalability({ ...scalability, automationPotential: v })} />
                <ScoreSelector label="Operational Complexity" description="10 = simple operations, 1 = operationally heavy" lowLabel="Very complex ops" highLabel="Simple ops" value={scalability.operationalComplexity} onChange={v => setScalability({ ...scalability, operationalComplexity: v })} />
                <ScoreSelector label="Dependence on Founder" description="10 = runs without the founder, 1 = founder does everything" lowLabel="Founder-dependent" highLabel="Runs without founder" value={scalability.dependenceOnFounder} onChange={v => setScalability({ ...scalability, dependenceOnFounder: v })} />
                <ScoreSelector label="Network Effects" value={scalability.networkEffects} onChange={v => setScalability({ ...scalability, networkEffects: v })} />
                <hr className="my-5 border-slate-200" />
                <h3 className="font-medium text-slate-800 mb-3">Risk Assessment</h3>
                <div className="hidden sm:grid grid-cols-3 gap-4 mb-2 text-xs font-medium text-slate-500">
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
                <h3 className="font-medium text-slate-800 mb-3">Investor Attractiveness</h3>
                <ScoreSelector label="Market Size" value={investorAttr.marketSize} onChange={v => setInvestorAttr({ ...investorAttr, marketSize: v })} />
                <ScoreSelector label="Growth Potential" value={investorAttr.growthPotential} onChange={v => setInvestorAttr({ ...investorAttr, growthPotential: v })} />
                <ScoreSelector label="Scalability" value={investorAttr.scalability} onChange={v => setInvestorAttr({ ...investorAttr, scalability: v })} />
                <ScoreSelector label="Exit Potential" value={investorAttr.exitPotential} onChange={v => setInvestorAttr({ ...investorAttr, exitPotential: v })} />
                <ScoreSelector label="Defensibility" value={investorAttr.defensibility} onChange={v => setInvestorAttr({ ...investorAttr, defensibility: v })} />
                <hr className="my-5 border-slate-200" />
                <h3 className="font-medium text-slate-800 mb-3">Innovation</h3>
                <ScoreSelector label="Uniqueness" value={innovation.uniqueness} onChange={v => setInnovation({ ...innovation, uniqueness: v })} />
                <ScoreSelector label="Patentability" value={innovation.patentability} onChange={v => setInnovation({ ...innovation, patentability: v })} />
                <ScoreSelector label="Competitive Advantage" value={innovation.competitiveAdvantage} onChange={v => setInnovation({ ...innovation, competitiveAdvantage: v })} />
                <ScoreSelector label="Disruption Potential" value={innovation.disruptionPotential} onChange={v => setInnovation({ ...innovation, disruptionPotential: v })} />
                <ScoreSelector label="Defensibility" value={innovation.defensibility} onChange={v => setInnovation({ ...innovation, defensibility: v })} />
              </div>
            )}

            {step === 5 && (
              <div>
                <h3 className="font-medium text-slate-800 mb-3">Social Impact</h3>
                <ScoreSelector label="Job Creation" value={socialImpact.jobCreation} onChange={v => setSocialImpact({ ...socialImpact, jobCreation: v })} />
                <ScoreSelector label="Environmental Benefit" value={socialImpact.environmentalBenefit} onChange={v => setSocialImpact({ ...socialImpact, environmentalBenefit: v })} />
                <ScoreSelector label="Community Benefit" value={socialImpact.communityBenefit} onChange={v => setSocialImpact({ ...socialImpact, communityBenefit: v })} />
                <ScoreSelector label="Inclusion" value={socialImpact.inclusion} onChange={v => setSocialImpact({ ...socialImpact, inclusion: v })} />
                <ScoreSelector label="Sustainability" value={socialImpact.sustainability} onChange={v => setSocialImpact({ ...socialImpact, sustainability: v })} />
                <hr className="my-5 border-slate-200" />
                <h3 className="font-medium text-slate-800 mb-3">Customer Validation (Yes / No)</h3>
                {[
                  { key: 'wouldUse', label: 'Would you use this product?' },
                  { key: 'wouldPay', label: 'Would you pay for it?' },
                  { key: 'wouldRecommend', label: 'Would you recommend it?' },
                  { key: 'solvesRealProblem', label: 'Does it solve a real problem?' },
                  { key: 'betterThanAlternatives', label: 'Is it better than current alternatives?' },
                ].map(q => (
                  <div key={q.key} className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-700">{q.label}</span>
                    <div className="flex gap-2">
                      {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(o => (
                        <button type="button" key={o.label}
                          onClick={() => setCustomerVal({ ...customerVal, [q.key]: o.val })}
                          className={`px-3 py-1 text-sm rounded border transition ${(customerVal as any)[q.key] === o.val ? (o.val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-600 text-white border-red-600') : 'border-slate-300 text-slate-500'}`}>
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
                <h3 className="font-medium text-slate-800 mb-1">Shark Tank Score</h3>
                <p className="text-xs text-slate-500 mb-3">Weighted: Problem 25%, Market 20%, Revenue 20%, Execution 15%, Scalability 20%</p>
                <ScoreSelector label="Problem Importance (25%)" value={sharkTank.problemImportance} onChange={v => setSharkTank({ ...sharkTank, problemImportance: v })} />
                <ScoreSelector label="Market Size (20%)" value={sharkTank.marketSize} onChange={v => setSharkTank({ ...sharkTank, marketSize: v })} />
                <ScoreSelector label="Revenue Potential (20%)" value={sharkTank.revenuePotential} onChange={v => setSharkTank({ ...sharkTank, revenuePotential: v })} />
                <ScoreSelector label="Execution Ease (15%)" value={sharkTank.executionEase} onChange={v => setSharkTank({ ...sharkTank, executionEase: v })} />
                <ScoreSelector label="Scalability (20%)" value={sharkTank.scalability} onChange={v => setSharkTank({ ...sharkTank, scalability: v })} />
                <hr className="my-5 border-slate-200" />
                <h3 className="font-medium text-slate-800 mb-1">Startup Validation Score</h3>
                <p className="text-xs text-slate-500 mb-3">Weighted: Team 25% · Market 20% · Product 15% · Traction 15% · Biz Model 10% · Competition 5% · Timing 5% · Funding 5%</p>
                <ScoreSelector label="Founder / Team Quality (25%)" value={startupSucc.founderTeam} onChange={v => setStartupSucc({ ...startupSucc, founderTeam: v })} />
                <ScoreSelector label="Market Size & Opportunity (20%)" value={startupSucc.marketSize} onChange={v => setStartupSucc({ ...startupSucc, marketSize: v })} />
                <ScoreSelector label="Product Differentiation (15%)" value={startupSucc.productDifferentiation} onChange={v => setStartupSucc({ ...startupSucc, productDifferentiation: v })} />
                <ScoreSelector label="Traction & Evidence of Demand (15%)" value={startupSucc.traction} onChange={v => setStartupSucc({ ...startupSucc, traction: v })} />
                <ScoreSelector label="Business Model Strength (10%)" value={startupSucc.businessModel} onChange={v => setStartupSucc({ ...startupSucc, businessModel: v })} />
                <ScoreSelector label="Competitive Advantage (5%)" value={startupSucc.competition} onChange={v => setStartupSucc({ ...startupSucc, competition: v })} />
                <ScoreSelector label="Market Timing (5%)" value={startupSucc.timing} onChange={v => setStartupSucc({ ...startupSucc, timing: v })} />
                <ScoreSelector label="Funding Readiness (5%)" value={startupSucc.fundingReadiness} onChange={v => setStartupSucc({ ...startupSucc, fundingReadiness: v })} />
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                {[
                  { key: 'biggestStrength', label: 'Biggest Strength', placeholder: 'What is the strongest aspect of this idea?' },
                  { key: 'biggestWeakness', label: 'Biggest Weakness', placeholder: 'What is the most significant weakness or risk?' },
                  { key: 'suggestedImprovement', label: 'One Suggested Improvement', placeholder: 'What single change would most improve this idea?' },
                ].map(f => (
                  <div key={f.key} id={`field-${f.key}`}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{f.label} *</label>
                    <textarea rows={3} placeholder={f.placeholder}
                      className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 resize-none ${feedbackErrors[f.key] ? 'border-red-400 focus:ring-red-500 bg-red-50' : 'border-slate-300 focus:ring-blue-500 bg-white'}`}
                      value={(openFeedback as any)[f.key]}
                      onChange={e => {
                        setOpenFeedback({ ...openFeedback, [f.key]: e.target.value });
                        setFeedbackErrors(prev => (prev[f.key] ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== f.key)) : prev));
                      }} />
                    {feedbackErrors[f.key] && <p className="text-xs text-red-600 mt-1 font-medium">{feedbackErrors[f.key]}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="border border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50">← Previous</button>
              )}
              <button onClick={saveDraft}
                className="border border-slate-300 text-slate-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50">
                {draftSavedAt ? 'Saved ✓' : 'Save Draft'}
              </button>
              <div className="flex-1" />
              {step < steps.length - 1 ? (
                <button onClick={() => setStep(s => s + 1)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700">Next Framework →</button>
              ) : (
                <button onClick={submit} disabled={submitting}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Validation'}
                </button>
              )}
            </div>
          </div>
        </div>

        <FrameworkOverviewPanel
          currentStepIndex={step}
          scores={frameworkScores}
          overallAveragePct={overallAverage * 10}
          completedCount={completedFrameworksCount}
        />
      </div>
    </div>
  );
}
