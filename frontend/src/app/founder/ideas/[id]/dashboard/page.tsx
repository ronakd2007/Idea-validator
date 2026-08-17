'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser, isViewMode } from '@/lib/auth';
import RadarChart from '@/components/RadarChart';
// xlsx (~1MB minified) and @react-pdf (~1MB) are loaded on demand inside the
// click handlers below — bundling them statically made every dashboard visit
// download and parse ~2MB of JS that most visits never use.
import {
  MATRIX_CATEGORIES, RISK_LABELS, breakdownStatus, dominantRisk, riskTone, RISK_LABEL,
  successLabel, sharkLabel, pctTone, resolveStrongestWeakest, TONE_DOM,
} from '@/lib/reportStatus';
import { parseAiSummary, toSentences, splitBoldRuns } from '@/lib/parseAiSummary';
import ValidationProgress, { ProgressStep } from '@/components/founder/ValidationProgress';
import ValidationGapCard from '@/components/founder/ValidationGapCard';
import { detectValidationGap } from '@/lib/validationGap';
import AssumptionCheckCard from '@/components/founder/AssumptionCheckCard';
import type { Assumption } from '@/lib/assumptionCheck';
import ScoreBreakdown from '@/components/founder/ScoreBreakdown';
import ShareIdeaModal from '@/components/founder/ShareIdeaModal';
import VersionTimeline, { IdeaVersion } from '@/components/founder/VersionTimeline';
import StatusBadge, { type BadgeTone } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/feedback';
import AIChatPanel from '@/components/chat/AIChatPanel';
import { STARTUP_STATUS_META } from '@/lib/startupTypes';

// Report tones (positive/warning/critical) → shared badge tones.
const REPORT_TONE_TO_BADGE: Record<string, BadgeTone> = {
  positive: 'success',
  warning: 'warning',
  critical: 'danger',
};

// The page's content grouped by the question it answers, not by scroll order.
const TABS = [
  { id: 'overview', label: 'Summary' },
  { id: 'scores', label: 'The Scores' },
  { id: 'surveys', label: 'Customer Surveys' },
  { id: 'insights', label: "What's Missing" },
  { id: 'experts', label: 'Expert Comments' },
] as const;
type TabId = (typeof TABS)[number]['id'];

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
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyAnalytics, setSurveyAnalytics] = useState<any>(null);
  // The gap card renders only after the survey fetch settles, so it never
  // flashes "no customer evidence" while analytics are still loading.
  const [surveysLoaded, setSurveysLoaded] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [versions, setVersions] = useState<IdeaVersion[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<{ publicId: string | null; publicShareEnabled: boolean; publicShareSettings: any } | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [assumptionList, setAssumptionList] = useState<Assumption[]>([]);
  // Startup Directory listing for this idea, if the founder has started one.
  const [startup, setStartup] = useState<any>(null);
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    setViewMode(isViewMode());
    // Deep link: #scores etc. opens that tab directly.
    const fromHash = window.location.hash.replace('#', '');
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash as TabId);
    api.getIdeaBenchmark(params.id as string).then(setBenchmark).catch(() => {});
    // 403 here simply means the idea isn't validated yet — not an error state.
    api.getStartupForIdea(params.id as string).then((r: any) => setStartup(r.startup)).catch(() => {});
    api.getIdeaDashboard(params.id as string)
      .then((d) => {
        setData(d);
        // Stored AI summary renders instantly; the button becomes "Regenerate".
        if (d?.idea?.aiSummary) setAiSummary(d.idea.aiSummary);
        try {
          const asm = JSON.parse(d?.idea?.assumptions || '[]');
          if (Array.isArray(asm)) setAssumptionList(asm.filter((x: any) => x?.statement));
        } catch { /* corrupt JSON reads as no assumptions */ }
        if (d?.idea) {
          setShare({
            publicId: d.idea.publicId ?? null,
            publicShareEnabled: !!d.idea.publicShareEnabled,
            publicShareSettings: d.idea.publicShareSettings ?? '{}',
          });
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    api.getIdeaVersions(params.id as string).then(setVersions).catch(() => {});
    api.getMySurveys()
      .then(async (all: any[]) => {
        const mine = all.filter((s) => s.ideaId === params.id);
        setSurveys(mine);
        const primary = mine.find((s) => s.status !== 'DRAFT');
        if (primary) {
          try { setSurveyAnalytics(await api.getSurveyAnalytics(primary.id)); } catch { /* evidence section just omits market data */ }
        }
      })
      .catch(() => {})
      .finally(() => setSurveysLoaded(true));
  }, []);

  const switchTab = (id: TabId) => {
    setTab(id);
    // keep the URL shareable without adding history entries per click
    window.history.replaceState(null, '', `#${id}`);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/2 bg-slate-200/70 rounded-md" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-200/70 rounded-xl" />)}
          </div>
          <div className="h-9 w-full max-w-md bg-slate-200/70 rounded-lg" />
          <div className="h-64 bg-slate-200/70 rounded-xl" />
        </div>
      </div>
    );
  }
  if (error) return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10"><div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">{error}</div></div>;

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

  // Where this idea sits in the validation journey — every state is derived
  // from data already loaded on this page, no extra requests.
  const totalSurveyResponses = surveys.reduce((sum, sv) => sum + (sv._count?.responses ?? 0), 0);
  const expertDone = (a.totalValidations || 0) > 0;
  const hasRisk = !!a.riskSummary && Object.keys(a.riskSummary).length > 0;
  const progressSteps: ProgressStep[] = [
    { label: 'Idea Submitted', state: 'done', detail: idea?.submittedAt ? new Date(idea.submittedAt).toLocaleDateString() : undefined },
    { label: 'Expert Validation', state: expertDone ? 'done' : 'active', detail: `${a.totalValidations || 0} expert review${a.totalValidations !== 1 ? 's' : ''}` },
    {
      label: 'Customer Validation',
      state: totalSurveyResponses > 0 ? 'done' : 'active',
      detail: totalSurveyResponses > 0 ? `${totalSurveyResponses} survey response${totalSurveyResponses !== 1 ? 's' : ''}` : 'Run a survey to test demand',
    },
    { label: 'Risk Assessment', state: hasRisk ? 'done' : 'pending', detail: hasRisk ? 'Assessed by experts' : 'Included in expert review' },
    { label: 'AI Analysis', state: aiSummary ? 'done' : (a.totalValidations || 0) > 0 ? 'active' : 'pending', detail: aiSummary ? 'Summary generated' : 'Generate in AI Summary below' },
    {
      label: 'Validation Complete',
      state: expertDone && !!aiSummary && totalSurveyResponses > 0 ? 'done' : 'pending',
      detail: expertDone && !!aiSummary && totalSurveyResponses > 0 ? 'Ready to share' : undefined,
    },
  ];

  // Insight layer on top of the score — never touches the score itself.
  const gapFinding = surveysLoaded ? detectValidationGap(a, surveyAnalytics, surveys.length) : null;
  const allCategoriesTied = matrixWithPct.length >= 2 && !strongest && !weakest;

  const generateAiSummary = async (refresh = false) => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await api.getAiSummary(params.id as string, refresh);
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
      const { downloadValidationReport } = await import('@/lib/generateValidationReport');
      await downloadValidationReport({ idea, aggregated: a, aiSummary, marketResponseLabel, surveyAnalytics });
      // Records the download for the admin activity feed. Deliberately not
      // awaited or surfaced — the report already reached the user, so a failed
      // log must not show them an error.
      api.recordReportDownload(idea.id).catch(() => {});
    } catch (err: any) {
      setReportError(err.message || 'Could not generate the report. Please try again.');
    } finally {
      setDownloadingReport(false);
    }
  };

  const downloadContacts = async () => {
    const XLSX = await import('xlsx');
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

  // ---------- header derivations ----------

  const headerStatus = expertDone
    ? { label: heroStatus.label, tone: REPORT_TONE_TO_BADGE[heroStatus.tone] || 'neutral' }
    : { label: 'Awaiting expert reviews', tone: 'info' as BadgeTone };

  // One primary next action, picked from the idea's actual state.
  const primaryAction = expertDone
    ? { kind: 'report' as const }
    : surveys.length === 0
      ? { kind: 'survey' as const }
      : null;

  const tabCounts: Partial<Record<TabId, number>> = {
    surveys: surveys.length,
    experts: a.totalValidations || 0,
  };

  // ---------- reusable section blocks (JSX kept intact, only regrouped) ----------

  const evidenceCard = (a.totalValidations > 0 || marketResponseLabel) && (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
      <h3 className="font-semibold text-slate-900 mb-1">Your two sources of proof</h3>
      <p className="text-xs text-slate-500 mb-4">
        Experts judge whether the idea is sound. Real customers tell you whether they actually want it.
        We keep them separate on purpose — a good idea nobody wants is still a bad business.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">What experts think</p>
          {a.totalValidations > 0 ? (
            <p className={`text-lg font-semibold ${TONE_DOM[heroStatus.tone].text}`}>{heroStatus.label}</p>
          ) : (
            <p className="text-sm text-slate-400">No expert has reviewed it yet</p>
          )}
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">What real customers said</p>
          {marketResponseLabel ? (
            <p className={`text-lg font-semibold ${TONE_DOM[marketResponseLabel.tone].text}`}>{marketResponseLabel.label}</p>
          ) : (
            <p className="text-sm text-slate-400">Not enough survey answers yet</p>
          )}
        </div>
      </div>
    </div>
  );

  const glanceBlock = (strongest || weakest || allCategoriesTied) && (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
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
  );

  const aiSummaryBlock = (
    <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <span className="text-blue-600">✦</span> AI Summary
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Powered by Groq AI — synthesises all validator scores and feedback</p>
        </div>
        {!aiSummary && (
          <button onClick={() => generateAiSummary(false)} disabled={aiLoading || viewMode}
            title={viewMode ? 'This action is disabled while viewing as another user.' : undefined}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
            {aiLoading ? (
              <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Generating...</>
            ) : 'Generate AI Summary'}
          </button>
        )}
        {aiSummary && !viewMode && (
          <button onClick={() => generateAiSummary(true)} disabled={aiLoading} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
            {aiLoading ? 'Regenerating…' : 'Regenerate'}
          </button>
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
                    <span>{meta.icon}</span>{heading === 'NEXT STEPS' ? 'WHAT SHOULD YOU DO NEXT?' : heading}
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
  );

  const surveysBlock = surveys.length > 0 ? (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Customer Surveys</h3>
          <p className="text-xs text-slate-500 mt-0.5">Answers from real people you shared your survey link with</p>
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
        {surveys.map((sv) => (
          <Link key={sv.id} href={sv.status === 'DRAFT' ? `/founder/surveys/${sv.id}/edit` : `/founder/surveys/${sv.id}/analytics`}
            className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition">
            <p className="text-sm font-medium text-slate-900 truncate">{sv.title || 'Untitled survey'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sv.status === 'LIVE' ? 'bg-emerald-50 text-emerald-700' : sv.status === 'CLOSED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{sv.status}</span>
              {sv.status !== 'DRAFT' && <span className="text-xs text-slate-400">{sv._count?.responses ?? 0} responses</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  ) : (
    <EmptyState
      icon="📊"
      title="No surveys for this idea yet"
      body="Expert opinions tell you if the idea is sound — a survey tells you if real customers actually want it. Run one to add market evidence next to your expert scores."
      action={
        <Link href="/founder/surveys" className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
          Create a Survey
        </Link>
      }
    />
  );

  return (
    <div className="flex">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 min-w-0">
      {/* ---------- header: who, how it's doing, what next ---------- */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge tone={headerStatus.tone as BadgeTone} dot>{headerStatus.label}</StatusBadge>
              {idea?.industryCategory && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{idea.industryCategory}</span>}
              {idea?.stage && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{idea.stage.replace('_', ' ')}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{idea?.title}</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {expertDone && (
              <>
                {viewMode ? (
                  <span title="This action is disabled while viewing as another user."
                    className="flex items-center gap-2 bg-slate-100 text-slate-400 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed">
                    ↻ Improve &amp; Re-validate
                  </span>
                ) : (
                  <Link href={`/founder/submit-idea?revise=${idea?.id}`}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:border-blue-300 hover:text-blue-700 transition">
                    ↻ Improve &amp; Re-validate
                  </Link>
                )}
                <button onClick={() => viewMode ? toast.info('This action is disabled while viewing as another user.') : setShareOpen(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${viewMode ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684zm0-9.316a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
                  </svg>
                  Share
                </button>
              </>
            )}
            {primaryAction?.kind === 'report' && (
              <button onClick={handleDownloadReport} disabled={downloadingReport}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                {downloadingReport ? (
                  <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Preparing...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download Report
                  </>
                )}
              </button>
            )}
            {primaryAction?.kind === 'survey' && (
              <Link href="/founder/surveys" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                Run a Survey
              </Link>
            )}
          </div>
        </div>
        {reportError && <p className="text-sm text-red-600 mt-2 text-right">{reportError}</p>}

        {/* Key numbers — the "how is it doing" strip, always visible above the tabs. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <div className="bg-blue-600 text-white rounded-xl p-4">
            <p className="text-[11px] font-medium text-blue-200 uppercase tracking-wide">Score out of 100</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {expertDone ? <>{(a.overallScore || 0).toFixed(0)}<span className="text-sm font-medium text-blue-200">/100</span></> : '—'}
            </p>
            <p className="text-[11px] text-blue-100 mt-0.5">{expertDone ? heroStatus.label : 'waiting for experts'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Experts who reviewed</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{a.totalValidations || 0}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">industry professionals</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">People who answered</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{totalSurveyResponses}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">from {surveys.length} survey{surveys.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Compared to others</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {benchmark?.percentile != null ? `Top ${Math.max(1, 100 - benchmark.percentile)}%` : '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {benchmark?.percentile != null
                ? `better than ${benchmark.percentile} out of every 100 ideas here`
                : 'not enough other ideas to compare yet'}
            </p>
          </div>
        </div>
      </div>

      {/* ---------- tabs ---------- */}
      <div className="border-b border-slate-200 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 overflow-x-auto whitespace-nowrap -mb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`px-3.5 py-2.5 text-sm font-medium border-b-2 transition shrink-0 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {t.label}
              {tabCounts[t.id] != null && tabCounts[t.id]! > 0 && (
                <span className={`ml-1.5 text-xs tabular-nums ${tab === t.id ? 'text-blue-500' : 'text-slate-400'}`}>{tabCounts[t.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Overview ---------- */}
      {tab === 'overview' && (
        <>
          {!expertDone && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <p className="text-amber-800 text-sm font-medium">
                Our experts are reviewing your idea — no validations in yet. Scores appear here the moment the first review lands.
              </p>
            </div>
          )}

          {/* Startup Directory — the natural next step once an idea is
              validated. Gated on the same condition as the report itself. */}
          {expertDone && (() => {
            const meta = startup ? STARTUP_STATUS_META[startup.status] : null;
            if (!startup) {
              return (
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">🚀 List My Startup</h3>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-xl">
                      Your idea is validated. Publish a public profile so investors, customers and partners can find you
                      in the Startup Directory — we&apos;ll prefill most of it from what you&apos;ve already written.
                    </p>
                  </div>
                  <Link
                    href={viewMode ? '#' : `/founder/ideas/${idea?.id}/list-startup`}
                    onClick={(e) => { if (viewMode) { e.preventDefault(); toast.info('This action is disabled while viewing as another user.'); } }}
                    className="shrink-0 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    List My Startup
                  </Link>
                </div>
              );
            }
            return (
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">🚀 Startup Listing</h3>
                      {meta && <StatusBadge tone={meta.tone as BadgeTone} dot>{meta.label}</StatusBadge>}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-xl">{meta?.blurb}</p>
                    {startup.status === 'CHANGES_REQUESTED' && startup.reviewMessage && (
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 whitespace-pre-line">
                        {startup.reviewMessage}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-wrap gap-2">
                    {startup.status === 'APPROVED' ? (
                      <Link href={`/startups/${startup.slug}`}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                        View public profile
                      </Link>
                    ) : startup.status !== 'REJECTED' ? (
                      <Link href={`/founder/ideas/${idea?.id}/list-startup`}
                        className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:border-blue-300 hover:text-blue-700 transition">
                        {startup.status === 'CHANGES_REQUESTED' ? 'Make changes' : 'Edit listing'}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })()}

          <ValidationProgress steps={progressSteps} />

          {evidenceCard}

          {expertDone && glanceBlock}

          {expertDone ? aiSummaryBlock : (
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-1">While you wait</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Expert reviews usually take a little time. Meanwhile you can collect market evidence with a survey
                (see the <button onClick={() => switchTab('surveys')} className="text-blue-600 font-medium hover:underline">Surveys</button> tab)
                and write down the assumptions your idea depends on
                (<button onClick={() => switchTab('insights')} className="text-blue-600 font-medium hover:underline">Insights</button> tab) —
                the platform will check them against your evidence automatically.
              </p>
            </div>
          )}

          <VersionTimeline versions={versions} />
        </>
      )}

      {/* ---------- Expert Scores ---------- */}
      {tab === 'scores' && (
        !expertDone ? (
          <EmptyState
            icon="🧑‍⚖️"
            title="No expert scores yet"
            body="Approved industry experts score your idea across 12 frameworks — market opportunity, feasibility, founder fit and more. Scores appear here as soon as the first review is submitted."
          />
        ) : (
          <>
            {/* Dominant score row */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-600 text-white rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <div className="text-5xl font-black tabular-nums">
                  {(a.overallScore || 0).toFixed(0)}<span className="text-xl font-semibold text-blue-200">/100</span>
                </div>
                <div className="text-blue-100 text-sm font-medium mt-1">Overall Score</div>
                <div className="mt-3 inline-block text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">{heroStatus.label}</div>
                {benchmark?.percentile != null && (
                  <div className="mt-3 text-xs text-blue-100">
                    Scores higher than <span className="font-bold text-white">{benchmark.percentile}%</span> of validated ideas
                    {benchmark.industryPercentile != null && (
                      <> · <span className="font-bold text-white">{benchmark.industryPercentile}%</span> in {idea?.industryCategory}</>
                    )}
                    <span className="block text-[10px] text-blue-200/80 mt-0.5">compared with {benchmark.cohortSize} validated idea{benchmark.cohortSize !== 1 ? 's' : ''} on this platform</span>
                  </div>
                )}
              </div>
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <div className={`text-3xl font-black mb-1 ${TONE_DOM[sh.tone].text}`}>{(a.sharkTankAvg || 0).toFixed(0)}</div>
                <div className="text-slate-500 text-sm">Investor appeal / 100</div>
                <div className={`text-xs font-medium mt-1 ${TONE_DOM[sh.tone].text}`}>{sh.label}</div>
                <div className="text-[11px] text-slate-400 mt-2 leading-snug">How an investor on a show like Shark Tank would likely react</div>
              </div>
              <div className={`border rounded-2xl p-6 flex flex-col items-center justify-center text-center ${TONE_DOM[s.tone].bg} ${TONE_DOM[s.tone].border}`}>
                <div className={`text-3xl font-black mb-1 ${TONE_DOM[s.tone].text}`}>{(a.startupSuccessAvg || 0).toFixed(0)}</div>
                <div className="text-slate-500 text-sm">Chance of succeeding / 100</div>
                <div className={`text-xs font-semibold mt-1 ${TONE_DOM[s.tone].text}`}>{s.label}</div>
                <div className="text-[11px] text-slate-400 mt-2 leading-snug">Based on team, market, timing and traction</div>
              </div>
            </div>

            {/* Validation Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-1">Score by area</h3>
              <p className="text-xs text-slate-500 mb-6">Experts scored your idea in 8 areas, each out of 50. Longer bar = stronger area.</p>
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

            {/* Why this score */}
            <ScoreBreakdown aggregated={a} />

            {/* Customer Validation */}
            {a.customerValidation && (
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-1">Would customers actually do it?</h3>
                <p className="text-xs text-slate-500 mb-6">The share of experts who believe a typical customer would take each action.</p>
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
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-1">Risks the experts flagged</h3>
                <p className="text-xs text-slate-500 mb-4">How likely each problem is to hurt you, based on how the experts voted.</p>
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
          </>
        )
      )}

      {/* ---------- Surveys ---------- */}
      {tab === 'surveys' && surveysBlock}

      {/* ---------- Insights ---------- */}
      {tab === 'insights' && (
        <>
          {gapFinding ? (
            <ValidationGapCard finding={gapFinding} ideaId={idea?.id} />
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-1">What&apos;s still missing</h3>
              <p className="text-sm text-slate-500">
                {expertDone
                  ? 'No standout weakness detected across your evidence right now. This re-checks automatically as new validations and survey responses arrive.'
                  : 'Once expert reviews and survey responses start arriving, this section pinpoints the weakest part of your validation story and can generate a targeted survey to fix it.'}
              </p>
            </div>
          )}
          {idea && (
            <AssumptionCheckCard
              ideaId={idea.id}
              assumptions={assumptionList}
              aggregated={a}
              surveyAnalytics={surveyAnalytics}
              gapKey={gapFinding?.key}
              readOnly={viewMode}
              onSaved={setAssumptionList}
            />
          )}
        </>
      )}

      {/* ---------- Experts & Feedback ---------- */}
      {tab === 'experts' && (
        !expertDone ? (
          <EmptyState
            icon="💬"
            title="No expert feedback yet"
            body="Each expert leaves written feedback — biggest strength, biggest weakness, and a suggested improvement — along with their contact details. It all appears here."
          />
        ) : (
          <>
            {/* Feedback */}
            {a.openFeedbacks?.length > 0 && (
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-1">What each expert said</h3>
                <p className="text-xs text-slate-500 mb-4">Written comments in their own words, with their contact details.</p>
                <div className="space-y-4">
                  {a.openFeedbacks.map((fb: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-slate-100">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{fb.validatorName}</p>
                          {fb.validatorOccupation && <p className="text-xs text-slate-500">{fb.validatorOccupation}</p>}
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-wrap">
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
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">People Who Want to Help</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{a.interestedContacts.length} validator{a.interestedContacts.length !== 1 ? 's' : ''} open to being contacted</p>
                  </div>
                  <button onClick={downloadContacts}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:border-blue-300 hover:text-blue-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download Excel Report
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

            {a.openFeedbacks?.length === 0 && a.interestedContacts?.length === 0 && (
              <EmptyState
                compact
                title="No written feedback yet"
                body="Experts have scored your idea, but none have left written feedback or opted into contact so far."
              />
            )}
          </>
        )
      )}

      {shareOpen && share && idea && (
        <ShareIdeaModal
          ideaId={idea.id}
          ideaTitle={idea.title}
          initialShare={share}
          onClose={() => setShareOpen(false)}
          onChanged={setShare}
        />
      )}
    </div>
    {idea && <AIChatPanel targetType="idea" targetId={idea.id} readOnly={viewMode} />}
    </div>
  );
}
