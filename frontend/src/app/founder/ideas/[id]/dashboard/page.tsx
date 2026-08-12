'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import RadarChart from '@/components/RadarChart';
import * as XLSX from 'xlsx';
import {
  MATRIX_CATEGORIES, RISK_LABELS, breakdownStatus, dominantRisk, riskTone, RISK_LABEL,
  successLabel, sharkLabel, pctTone, resolveStrongestWeakest, TONE_DOM,
} from '@/lib/reportStatus';
import { downloadValidationReport } from '@/lib/generateValidationReport';
import { parseAiSummary, toSentences, splitBoldRuns } from '@/lib/parseAiSummary';

const NAV_LINKS = [
  { id: 'glance', label: 'At a Glance' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'customer-validation', label: 'Customer Validation' },
  { id: 'risks', label: 'Risks' },
  { id: 'ai-summary', label: 'AI Summary' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'people', label: 'People' },
];

// Renders **bold** spans from AI text as real <strong> instead of raw asterisks.
function renderInlineMarkdown(text: string): ReactNode {
  return splitBoldRuns(text).map((run, i) =>
    run.bold ? (
      <strong key={i} className="font-semibold text-slate-900">{run.text}</strong>
    ) : (
      <span key={i}>{run.text}</span>
    )
  );
}

export default function IdeaDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyAnalytics, setSurveyAnalytics] = useState<any>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getIdeaDashboard(params.id as string)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    api.getMySurveys()
      .then(async (all: any[]) => {
        const mine = all.filter((s) => s.ideaId === params.id);
        setSurveys(mine);
        const primary = mine.find((s) => s.status !== 'DRAFT');
        if (primary) {
          try { setSurveyAnalytics(await api.getSurveyAnalytics(primary.id)); } catch { /* evidence section just omits market data */ }
        }
      })
      .catch(() => {});
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Loading dashboard...</div></div>;
  if (error) return <div className="max-w-2xl mx-auto px-6 py-10"><div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">{error}</div></div>;

  const { idea, aggregated } = data || {};
  const a = aggregated || {};

  const heroStatus = successLabel(a.overallScore || 0);
  const s = successLabel(a.startupSuccessAvg || 0);
  const sh = sharkLabel(a.sharkTankAvg || 0);

  // Derived only from real survey analytics data — omitted entirely (not guessed) when there isn't enough of it.
  const primaryOutcome = surveyAnalytics?.eligibleOutcomeQuestions?.[0];
  const primaryOutcomeStat = primaryOutcome
    ? surveyAnalytics.questions.find((q: any) => q.id === primaryOutcome.id)
    : null;
  let positivePct: number | null = null;
  if (primaryOutcomeStat) {
    if (primaryOutcome.type === 'YES_NO') {
      const yes = primaryOutcomeStat.distribution?.find((d: any) => d.label === 'Yes');
      positivePct = yes ? yes.pct : null;
    } else if (primaryOutcomeStat.average != null) {
      positivePct = (primaryOutcomeStat.average / primaryOutcomeStat.max) * 100;
    }
  }
  const tryQuestion = surveyAnalytics?.questions?.find((q: any) => /try|purchase|buy|use this/i.test(q.questionText) && q.distribution);
  const tryYes = tryQuestion?.distribution?.find((d: any) => d.label === 'Yes');

  const marketResponseLabel = (() => {
    if (!surveyAnalytics || surveyAnalytics.summary.totalResponses < 5) return null;
    if (positivePct == null) return null;
    if (positivePct >= 60) return { label: 'Positive', tone: 'positive' as const };
    if (positivePct >= 35) return { label: 'Mixed', tone: 'warning' as const };
    return { label: 'Limited', tone: 'critical' as const };
  })();

  const matrixWithPct = MATRIX_CATEGORIES
    .map(c => ({ ...c, score: (a as any)[c.key] || 0, pct: (((a as any)[c.key] || 0) / 50) * 100 }))
    .filter(c => c.score > 0);
  const { strongest, weakest } = resolveStrongestWeakest(matrixWithPct);
  const allCategoriesTied = matrixWithPct.length >= 2 && !strongest && !weakest;

  const generateAiSummary = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await api.getAiSummary(params.id as string);
      setAiSummary(res.summary);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Uses only data already loaded in this component — the report never fetches
  // or generates anything new, including the AI summary (that stays whatever
  // is currently in `aiSummary`, possibly empty if never generated).
  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    setReportError('');
    try {
      await downloadValidationReport({ idea, aggregated: a, aiSummary, marketResponseLabel, surveyAnalytics });
    } catch (err: any) {
      setReportError(err.message || 'Could not generate the report. Please try again.');
    } finally {
      setDownloadingReport(false);
    }
  };

  const downloadContacts = () => {
    const validations: any[] = idea?.validations || [];

    const sum5 = (obj: any, keys: string[]) =>
      obj ? keys.reduce((s: number, k: string) => s + (obj[k] || 0), 0) : '';

    const calcShark = (st: any) => st
      ? +((st.problemImportance / 10) * 25 + (st.marketSize / 10) * 20 +
          (st.revenuePotential / 10) * 20 + (st.executionEase / 10) * 15 +
          (st.scalability / 10) * 20).toFixed(1)
      : '';

    const calcSuccess = (ss: any) => ss
      ? +((ss.founderTeam / 10) * 25 + (ss.marketSize / 10) * 20 +
          (ss.productDifferentiation / 10) * 15 + (ss.traction / 10) * 15 +
          (ss.businessModel / 10) * 10 + (ss.competition / 10) * 5 +
          (ss.timing / 10) * 5 + (ss.fundingReadiness / 10) * 5).toFixed(1)
      : '';

    const buildRow = (v: any, idx: number) => {
      const mo = v.marketOpportunity; const fe = v.feasibility; const ff = v.founderFit;
      const rp = v.revenuePotential; const sc = v.scalability; const ia = v.investorAttractiveness;
      const inn = v.innovation; const si = v.socialImpact; const cv = v.customerValidation;
      const ra = v.riskAssessment; const st = v.sharkTank; const ss = v.startupSuccess;
      const of = v.openFeedback;
      const prefs: string[] = JSON.parse(v.validator.validatorProfile?.contactPreferences || '[]');
      return {
        // Identity — shared for every validator the moment they submit a validation
        'Validator': v.validator.name,
        'Email': v.validator.email,
        'Phone': v.validator.phone || '',
        'LinkedIn': v.validator.validatorProfile?.linkedinUrl || '',
        'Occupation': v.validator.validatorProfile?.occupation || '',
        'Contact Interests': prefs.map((p: string) => p.replace(/_/g, ' ')).join(', '),

        // Market Opportunity (/50)
        'MO: Problem Severity': mo?.problemSeverity ?? '',
        'MO: Market Size': mo?.marketSize ?? '',
        'MO: Willingness to Pay': mo?.willingnessToPay ?? '',
        'MO: Market Growth Rate': mo?.marketGrowthRate ?? '',
        'MO: Competition Gap': mo?.competitionGap ?? '',
        'MO: TOTAL (/50)': sum5(mo, ['problemSeverity','marketSize','willingnessToPay','marketGrowthRate','competitionGap']),

        // Feasibility (/50)
        'FE: Technical Complexity': fe?.technicalComplexity ?? '',
        'FE: Capital Requirement': fe?.capitalRequirement ?? '',
        'FE: Regulatory Difficulty': fe?.regulatoryDifficulty ?? '',
        'FE: Talent Availability': fe?.talentAvailability ?? '',
        'FE: Time to Launch': fe?.timeToLaunch ?? '',
        'FE: TOTAL (/50)': sum5(fe, ['technicalComplexity','capitalRequirement','regulatoryDifficulty','talentAvailability','timeToLaunch']),

        // Founder Fit (/50)
        'FF: Industry Knowledge': ff?.industryKnowledge ?? '',
        'FF: Relevant Experience': ff?.relevantExperience ?? '',
        'FF: Network Access': ff?.networkAccess ?? '',
        'FF: Passion': ff?.passion ?? '',
        'FF: Skill Alignment': ff?.skillAlignment ?? '',
        'FF: TOTAL (/50)': sum5(ff, ['industryKnowledge','relevantExperience','networkAccess','passion','skillAlignment']),

        // Revenue Potential (/50)
        'RP: Pricing Power': rp?.pricingPower ?? '',
        'RP: Recurring Revenue': rp?.recurringRevenuePotential ?? '',
        'RP: Profit Margin': rp?.profitMarginPotential ?? '',
        'RP: Upsell Opportunities': rp?.upsellOpportunities ?? '',
        'RP: Customer LTV': rp?.customerLifetimeValue ?? '',
        'RP: TOTAL (/50)': sum5(rp, ['pricingPower','recurringRevenuePotential','profitMarginPotential','upsellOpportunities','customerLifetimeValue']),

        // Scalability (/50)
        'SC: Geographic Expansion': sc?.geographicExpansion ?? '',
        'SC: Automation Potential': sc?.automationPotential ?? '',
        'SC: Operational Complexity': sc?.operationalComplexity ?? '',
        'SC: Founder Dependence': sc?.dependenceOnFounder ?? '',
        'SC: Network Effects': sc?.networkEffects ?? '',
        'SC: TOTAL (/50)': sum5(sc, ['geographicExpansion','automationPotential','operationalComplexity','dependenceOnFounder','networkEffects']),

        // Investor Attractiveness (/50)
        'IA: Market Size': ia?.marketSize ?? '',
        'IA: Growth Potential': ia?.growthPotential ?? '',
        'IA: Scalability': ia?.scalability ?? '',
        'IA: Exit Potential': ia?.exitPotential ?? '',
        'IA: Defensibility': ia?.defensibility ?? '',
        'IA: TOTAL (/50)': sum5(ia, ['marketSize','growthPotential','scalability','exitPotential','defensibility']),

        // Innovation (/50)
        'IN: Uniqueness': inn?.uniqueness ?? '',
        'IN: Patentability': inn?.patentability ?? '',
        'IN: Competitive Advantage': inn?.competitiveAdvantage ?? '',
        'IN: Disruption Potential': inn?.disruptionPotential ?? '',
        'IN: Defensibility': inn?.defensibility ?? '',
        'IN: TOTAL (/50)': sum5(inn, ['uniqueness','patentability','competitiveAdvantage','disruptionPotential','defensibility']),

        // Social Impact (/50)
        'SI: Job Creation': si?.jobCreation ?? '',
        'SI: Environmental Benefit': si?.environmentalBenefit ?? '',
        'SI: Community Benefit': si?.communityBenefit ?? '',
        'SI: Inclusion': si?.inclusion ?? '',
        'SI: Sustainability': si?.sustainability ?? '',
        'SI: TOTAL (/50)': sum5(si, ['jobCreation','environmentalBenefit','communityBenefit','inclusion','sustainability']),

        // Shark Tank (/100 weighted)
        'ST: Problem Importance': st?.problemImportance ?? '',
        'ST: Market Size': st?.marketSize ?? '',
        'ST: Revenue Potential': st?.revenuePotential ?? '',
        'ST: Execution Ease': st?.executionEase ?? '',
        'ST: Scalability': st?.scalability ?? '',
        'ST: WEIGHTED SCORE (/100)': calcShark(st),

        // Validation Score (/100 weighted)
        'VS: Founder / Team': ss?.founderTeam ?? '',
        'VS: Market Size': ss?.marketSize ?? '',
        'VS: Product Differentiation': ss?.productDifferentiation ?? '',
        'VS: Traction': ss?.traction ?? '',
        'VS: Business Model': ss?.businessModel ?? '',
        'VS: Competition': ss?.competition ?? '',
        'VS: Timing': ss?.timing ?? '',
        'VS: Funding Readiness': ss?.fundingReadiness ?? '',
        'VS: WEIGHTED SCORE (/100)': calcSuccess(ss),

        // Customer Validation (Yes/No)
        'CV: Would Use': cv ? (cv.wouldUse ? 'Yes' : 'No') : '',
        'CV: Would Pay': cv ? (cv.wouldPay ? 'Yes' : 'No') : '',
        'CV: Would Recommend': cv ? (cv.wouldRecommend ? 'Yes' : 'No') : '',
        'CV: Solves Real Problem': cv ? (cv.solvesRealProblem ? 'Yes' : 'No') : '',
        'CV: Better Than Alternatives': cv ? (cv.betterThanAlternatives ? 'Yes' : 'No') : '',

        // Risk Assessment
        'RISK: Competition – Probability': ra?.competitionProbability ?? '',
        'RISK: Competition – Impact': ra?.competitionImpact ?? '',
        'RISK: Regulatory – Probability': ra?.regulatoryProbability ?? '',
        'RISK: Regulatory – Impact': ra?.regulatoryImpact ?? '',
        'RISK: Technology – Probability': ra?.technologyProbability ?? '',
        'RISK: Technology – Impact': ra?.technologyImpact ?? '',
        'RISK: Funding – Probability': ra?.fundingProbability ?? '',
        'RISK: Funding – Impact': ra?.fundingImpact ?? '',
        'RISK: Market Adoption – Probability': ra?.marketAdoptionProbability ?? '',
        'RISK: Market Adoption – Impact': ra?.marketAdoptionImpact ?? '',

        // Open Feedback
        'Biggest Strength': of?.biggestStrength ?? '',
        'Biggest Weakness': of?.biggestWeakness ?? '',
        'Suggested Improvement': of?.suggestedImprovement ?? '',
      };
    };

    const wb = XLSX.utils.book_new();
    const colW = { wch: 22 };

    // Sheet 1 — Idea Summary
    const summaryRows = [
      { Field: 'Idea Title', Value: idea?.title ?? '' },
      { Field: 'Industry', Value: idea?.industryCategory ?? '' },
      { Field: 'Stage', Value: (idea?.stage ?? '').replace('_', ' ') },
      { Field: 'Submitted', Value: idea?.submittedAt ? new Date(idea.submittedAt).toLocaleDateString() : '' },
      { Field: 'Total Validations', Value: a.totalValidations ?? 0 },
      { Field: '', Value: '' },
      { Field: '── AGGREGATED SCORES ──', Value: '' },
      { Field: 'Overall Score (%)', Value: +(a.overallScore || 0).toFixed(1) },
      { Field: 'Shark Tank Score (/100)', Value: +(a.sharkTankAvg || 0).toFixed(1) },
      { Field: 'Validation Score (/100)', Value: +(a.startupSuccessAvg || 0).toFixed(1) },
      { Field: 'Market Opportunity (/50)', Value: +(a.marketOpportunityAvg || 0).toFixed(1) },
      { Field: 'Feasibility (/50)', Value: +(a.feasibilityAvg || 0).toFixed(1) },
      { Field: 'Founder Fit (/50)', Value: +(a.founderFitAvg || 0).toFixed(1) },
      { Field: 'Revenue Potential (/50)', Value: +(a.revenuePotentialAvg || 0).toFixed(1) },
      { Field: 'Scalability (/50)', Value: +(a.scalabilityAvg || 0).toFixed(1) },
      { Field: 'Innovation (/50)', Value: +(a.innovationAvg || 0).toFixed(1) },
      { Field: 'Social Impact (/50)', Value: +(a.socialImpactAvg || 0).toFixed(1) },
      { Field: 'Investor Attractiveness (/50)', Value: +(a.investorAttractivenessAvg || 0).toFixed(1) },
      { Field: '', Value: '' },
      { Field: '── CUSTOMER VALIDATION ──', Value: '' },
      { Field: 'Would Use (%)', Value: +(a.customerValidation?.wouldUse || 0).toFixed(1) },
      { Field: 'Would Pay (%)', Value: +(a.customerValidation?.wouldPay || 0).toFixed(1) },
      { Field: 'Would Recommend (%)', Value: +(a.customerValidation?.wouldRecommend || 0).toFixed(1) },
      { Field: 'Solves Real Problem (%)', Value: +(a.customerValidation?.solvesRealProblem || 0).toFixed(1) },
      { Field: 'Better Than Alternatives (%)', Value: +(a.customerValidation?.betterThanAlternatives || 0).toFixed(1) },
    ];
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, '1. Idea Summary');

    // Sheet 2 — Validator Contacts & Full Scores (every validator who submitted)
    const contactRows = validations.map((v: any, i: number) => buildRow(v, i));
    if (contactRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(contactRows);
      ws2['!cols'] = Object.keys(contactRows[0]).map(() => colW);
      XLSX.utils.book_append_sheet(wb, ws2, '2. Validator Contacts & Scores');
    }

    // Sheet 3 — Risk Summary
    const riskRows = Object.entries(a.riskSummary || {}).map(([risk, counts]: any) => ({
      'Risk Type': risk.replace(/([A-Z])/g, ' $1').trim(),
      'Low Count': counts.LOW ?? 0,
      'Medium Count': counts.MEDIUM ?? 0,
      'High Count': counts.HIGH ?? 0,
    }));
    if (riskRows.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(riskRows);
      ws4['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws4, '3. Risk Summary');
    }

    const ideaTitle = (idea?.title || 'idea').replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `validation_report_${ideaTitle}.xlsx`);
  };

  const sectionMeta: Record<string, { icon: string; color: string; bg: string }> = {
    'VERDICT': { icon: '⚡', color: 'text-blue-700', bg: 'bg-blue-100' },
    "WHAT'S WORKING": { icon: '✓', color: 'text-emerald-700', bg: 'bg-emerald-100' },
    'WHAT NEEDS WORK': { icon: '!', color: 'text-amber-700', bg: 'bg-amber-100' },
    'NEXT STEPS': { icon: '→', color: 'text-blue-700', bg: 'bg-blue-100' },
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header / Hero */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {idea?.industryCategory && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{idea.industryCategory}</span>}
          {idea?.stage && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{idea.stage.replace('_', ' ')}</span>}
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{idea?.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{a.totalValidations || 0} validation{a.totalValidations !== 1 ? 's' : ''} received</p>
      </div>

      {/* Mass Survey — a separate evidence source from Expert Validation, shown side by side and never combined into one score */}
      {surveys.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Mass Survey</h3>
              <p className="text-xs text-slate-500 mt-0.5">Public survey responses — a separate evidence source from Expert Validation</p>
            </div>
            <Link href="/founder/surveys" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Manage Surveys &rarr;</Link>
          </div>

          {surveyAnalytics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 pb-5 border-b border-slate-100">
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{surveyAnalytics.summary.totalResponses}</p>
                <p className="text-xs text-slate-500">Responses</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{positivePct != null ? `${positivePct.toFixed(0)}%` : 'N/A'}</p>
                <p className="text-xs text-slate-500">Positive</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{tryYes ? `${tryYes.pct.toFixed(0)}%` : 'N/A'}</p>
                <p className="text-xs text-slate-500">Would Try</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{surveyAnalytics.summary.avgCompletionTime}</p>
                <p className="text-xs text-slate-500">Avg. Time</p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {surveys.map((s) => (
              <Link key={s.id} href={s.status === 'DRAFT' ? `/founder/surveys/${s.id}/edit` : `/founder/surveys/${s.id}/analytics`}
                className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition">
                <p className="text-sm font-medium text-slate-900 truncate">{s.title || 'Untitled survey'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.status === 'LIVE' ? 'bg-emerald-50 text-emerald-700' : s.status === 'CLOSED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
                  {s.status !== 'DRAFT' && <span className="text-xs text-slate-400">{s._count?.responses ?? 0} responses</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Two separate evidence sources, shown side by side — deliberately never combined into one score */}
      {(a.totalValidations > 0 || marketResponseLabel) && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">Validation Evidence</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Expert Perspective</p>
              {a.totalValidations > 0 ? (
                <p className={`text-lg font-semibold ${TONE_DOM[heroStatus.tone].text}`}>{heroStatus.label}</p>
              ) : (
                <p className="text-sm text-slate-400">No expert validations yet</p>
              )}
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Market Response</p>
              {marketResponseLabel ? (
                <p className={`text-lg font-semibold ${TONE_DOM[marketResponseLabel.tone].text}`}>{marketResponseLabel.label}</p>
              ) : (
                <p className="text-sm text-slate-400">Not enough survey responses yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {a.totalValidations === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-center">
          <p className="text-amber-700 font-medium">No validations received yet. Check back later!</p>
        </div>
      )}

      {a.totalValidations > 0 && (
        <>
          {/* Dominant score row */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-600 text-white rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <div className="text-5xl font-black tabular-nums">
                {(a.overallScore || 0).toFixed(0)}<span className="text-xl font-semibold text-blue-200">/100</span>
              </div>
              <div className="text-blue-100 text-sm font-medium mt-1">Overall Score</div>
              <div className="mt-3 inline-block text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">{heroStatus.label}</div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <div className={`text-3xl font-black mb-1 ${TONE_DOM[sh.tone].text}`}>{(a.sharkTankAvg || 0).toFixed(0)}</div>
              <div className="text-slate-500 text-sm">Shark Tank Score / 100</div>
              <div className={`text-xs font-medium mt-1 ${TONE_DOM[sh.tone].text}`}>{sh.label}</div>
            </div>
            <div className={`border rounded-2xl p-6 flex flex-col items-center justify-center text-center ${TONE_DOM[s.tone].bg} ${TONE_DOM[s.tone].border}`}>
              <div className={`text-3xl font-black mb-1 ${TONE_DOM[s.tone].text}`}>{(a.startupSuccessAvg || 0).toFixed(0)}</div>
              <div className="text-slate-500 text-sm">Validation Score / 100</div>
              <div className={`text-xs font-semibold mt-1 ${TONE_DOM[s.tone].text}`}>{s.label}</div>
            </div>
          </div>

          <div className="flex justify-end mb-6">
            <button onClick={handleDownloadReport} disabled={downloadingReport}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60">
              {downloadingReport ? (
                <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Preparing report...</>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download Validation Report
                </>
              )}
            </button>
          </div>
          {reportError && <p className="text-sm text-red-600 mb-6 text-right">{reportError}</p>}

          {/* Quick nav */}
          <div className="flex gap-4 text-xs text-slate-500 overflow-x-auto whitespace-nowrap mb-8 pb-1 border-b border-slate-200">
            {NAV_LINKS.map(l => (
              <a key={l.id} href={`#${l.id}`} className="hover:text-blue-600 transition-colors">{l.label}</a>
            ))}
          </div>

          {/* At a Glance */}
          {(strongest || weakest || allCategoriesTied) && (
            <div id="glance" className="scroll-mt-6 grid md:grid-cols-2 gap-4 mb-8">
              {strongest ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold uppercase tracking-wide mb-2">
                    <span>▲</span> Biggest Strength
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{strongest.label}</p>
                  <p className="text-sm text-slate-600 mt-1">{strongest.pct.toFixed(0)}% of max — the strongest area across validator scoring.</p>
                </div>
              ) : allCategoriesTied && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
                    <span>▲</span> Biggest Strength
                  </div>
                  <p className="text-sm text-slate-600">No clear strength identified yet. All validation categories currently have the same average score.</p>
                </div>
              )}
              {weakest ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold uppercase tracking-wide mb-2">
                    <span>▼</span> Biggest Risk
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{weakest.label}</p>
                  <p className="text-sm text-slate-600 mt-1">{weakest.pct.toFixed(0)}% of max — the area validators rated weakest.</p>
                </div>
              ) : allCategoriesTied && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
                    <span>▼</span> Biggest Risk
                  </div>
                  <p className="text-sm text-slate-600">No single highest-risk category identified yet. All validation categories currently have the same average score.</p>
                </div>
              )}
            </div>
          )}

          {/* Validation Breakdown */}
          <div id="breakdown" className="scroll-mt-6 bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-slate-900 mb-1">Validation Breakdown</h3>
            <p className="text-xs text-slate-500 mb-6">All 8 scoring categories, out of 50 points each.</p>
            <div className="grid lg:grid-cols-2 gap-x-10 gap-y-5">
              {matrixWithPct.map(c => {
                const st = breakdownStatus(c.pct);
                return (
                  <div key={c.key}>
                    <div className="flex justify-between items-baseline mb-1.5 gap-2">
                      <span className="text-sm text-slate-700">{c.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TONE_DOM[st.tone].chip}`}>{st.label}</span>
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">{c.score.toFixed(1)}/50</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${TONE_DOM[st.tone].bar}`} style={{ width: `${Math.min(c.pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {matrixWithPct.length >= 3 && (
              <div className="border-t border-slate-100 mt-6 pt-6">
                <RadarChart data={matrixWithPct.map(c => ({ label: c.short, value: c.pct }))} />
              </div>
            )}
          </div>

          {/* Customer Validation */}
          {a.customerValidation && (
            <div id="customer-validation" className="scroll-mt-6 bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-6">Customer Validation</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {[
                  { label: 'Would Use It', val: a.customerValidation.wouldUse },
                  { label: 'Would Pay', val: a.customerValidation.wouldPay },
                  { label: 'Would Recommend', val: a.customerValidation.wouldRecommend },
                  { label: 'Solves Real Problem', val: a.customerValidation.solvesRealProblem },
                  { label: 'Better Than Alternatives', val: a.customerValidation.betterThanAlternatives },
                ].map(item => {
                  const tone = TONE_DOM[pctTone(item.val)];
                  return (
                    <div key={item.label} className="text-center">
                      <div className={`text-3xl md:text-4xl font-black tabular-nums ${tone.text}`}>{item.val.toFixed(0)}%</div>
                      <div className="text-xs text-slate-500 mt-1.5 mb-2">{item.label}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${Math.min(item.val, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          {a.riskSummary && Object.keys(a.riskSummary).length > 0 && (
            <div id="risks" className="scroll-mt-6 bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-4">Risk Assessment</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(a.riskSummary).map(([risk, counts]: any) => {
                  const level = dominantRisk(counts);
                  const tone = TONE_DOM[riskTone(level)];
                  return (
                    <div key={risk} className={`border rounded-lg p-4 ${tone.chip} ${tone.border}`}>
                      <p className="text-xs font-medium opacity-70 mb-2">{RISK_LABELS[risk] || risk}</p>
                      <p className="text-sm font-bold">{RISK_LABEL[level]}</p>
                      <p className="text-[11px] mt-2 opacity-70">{counts.LOW || 0} low · {counts.MEDIUM || 0} med · {counts.HIGH || 0} high</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div id="ai-summary" className="scroll-mt-6 bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <span className="text-blue-600">✦</span> AI Summary
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Powered by Groq AI — synthesises all validator scores and feedback</p>
              </div>
              {!aiSummary && (
                <button onClick={generateAiSummary} disabled={aiLoading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                  {aiLoading ? (
                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Generating...</>
                  ) : 'Generate AI Summary'}
                </button>
              )}
              {aiSummary && (
                <button onClick={() => { setAiSummary(''); setAiError(''); }} className="text-xs text-blue-600 hover:underline">Regenerate</button>
              )}
            </div>

            {aiError && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{aiError}</div>}

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-blue-600">
                <div className="animate-spin w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full mb-3 border-[3px]"></div>
                <p className="text-sm">Analysing your validation data...</p>
              </div>
            )}

            {aiSummary && (() => {
              const sections = parseAiSummary(aiSummary);
              return (
                <div className="grid md:grid-cols-2 gap-4">
                  {sections.map(({ heading, body }) => {
                    const meta = sectionMeta[heading] || { icon: '•', color: 'text-slate-700', bg: 'bg-slate-100' };
                    return (
                      <div key={heading} className={`bg-white rounded-lg p-5 border border-slate-200 ${heading === 'VERDICT' ? 'md:col-span-2' : ''}`}>
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full mb-3 ${meta.bg} ${meta.color}`}>
                          <span>{meta.icon}</span>{heading}
                        </div>
                        {heading === 'VERDICT' && (
                          <p className="text-base text-slate-800 leading-relaxed font-medium">{renderInlineMarkdown(body)}</p>
                        )}
                        {heading === 'NEXT STEPS' && (
                          <ol className="space-y-2.5">
                            {toSentences(body).map((sentence, i) => (
                              <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                <span>{renderInlineMarkdown(sentence)}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                        {(heading === "WHAT'S WORKING" || heading === 'WHAT NEEDS WORK') && (
                          <ul className="space-y-2">
                            {toSentences(body).map((sentence, i) => (
                              <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${heading === "WHAT'S WORKING" ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span>{renderInlineMarkdown(sentence)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {!aiSummary && !aiLoading && !aiError && (
              <p className="text-sm text-slate-500 text-center py-4">Click &quot;Generate AI Summary&quot; to get an instant analysis of your validation results.</p>
            )}
          </div>

          {/* Feedback */}
          {a.openFeedbacks?.length > 0 && (
            <div id="feedback" className="scroll-mt-6 bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-1">Validator Feedback</h3>
              <p className="text-xs text-slate-500 mb-4">Per-validator written feedback, with contact details shared on submission.</p>
              <div className="space-y-4">
                {a.openFeedbacks.map((fb: any, i: number) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{fb.validatorName}</p>
                        {fb.validatorOccupation && <p className="text-xs text-slate-500">{fb.validatorOccupation}</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {fb.validatorEmail && <a href={`mailto:${fb.validatorEmail}`} className="text-blue-600 hover:underline">{fb.validatorEmail}</a>}
                        {fb.validatorPhone && <a href={`tel:${fb.validatorPhone}`} className="text-blue-600 hover:underline">{fb.validatorPhone}</a>}
                        {fb.validatorLinkedinUrl && <a href={fb.validatorLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LinkedIn</a>}
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-1"><span>▲</span>Biggest Strength</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{fb.strength}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mb-1"><span>▼</span>Biggest Weakness</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{fb.weakness}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-1"><span>→</span>Suggested Improvement</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{fb.improvement}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interested Contacts */}
          {a.interestedContacts?.length > 0 && (
            <div id="people" className="scroll-mt-6 bg-white border border-slate-200 shadow-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">People Who Want to Help</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{a.interestedContacts.length} validator{a.interestedContacts.length !== 1 ? 's' : ''} open to being contacted</p>
                </div>
                <button onClick={downloadContacts}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download Full Report
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {a.interestedContacts.map((contact: any, i: number) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-4">
                    <p className="font-medium text-slate-900">{contact.name}</p>
                    {contact.occupation && <p className="text-sm text-slate-500">{contact.occupation}</p>}
                    <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline break-all">{contact.email}</a>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(Array.isArray(contact.contactPreferences) ? contact.contactPreferences : []).map((p: string) => (
                        <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
