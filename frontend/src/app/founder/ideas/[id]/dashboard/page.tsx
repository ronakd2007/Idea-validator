'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import ScoreBar from '@/components/ScoreBar';
import * as XLSX from 'xlsx';

const riskColor = (level: string) => {
  if (level === 'HIGH') return 'text-red-600 bg-red-100';
  if (level === 'MEDIUM') return 'text-yellow-600 bg-yellow-100';
  return 'text-green-600 bg-green-100';
};

export default function IdeaDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getIdeaDashboard(params.id as string)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading dashboard...</div></div>;
  if (error) return <div className="max-w-2xl mx-auto px-6 py-10"><div className="bg-red-50 text-red-700 rounded-lg p-4">{error}</div></div>;

  const { idea, aggregated } = data || {};
  const a = aggregated || {};

  const successLabel = (score: number) => {
    if (score >= 90) return { label: 'Very High Potential', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
    if (score >= 80) return { label: 'High Potential', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
    if (score >= 70) return { label: 'Good Potential', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
    if (score >= 60) return { label: 'Moderate Potential', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    return { label: 'High Risk', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  };

  const sharkLabel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Fair', color: 'text-yellow-600' };
    return { label: 'Weak', color: 'text-red-600' };
  };

  const s = successLabel(a.startupSuccessAvg || 0);
  const sh = sharkLabel(a.sharkTankAvg || 0);

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

  const parseSummary = (text: string) => {
    const sections = ['VERDICT', "WHAT'S WORKING", 'WHAT NEEDS WORK', 'NEXT STEPS'];
    const result: { heading: string; body: string }[] = [];
    for (let i = 0; i < sections.length; i++) {
      const start = text.indexOf(sections[i]);
      if (start === -1) continue;
      const contentStart = start + sections[i].length;
      const end = i < sections.length - 1
        ? sections.slice(i + 1).map(s => text.indexOf(s, contentStart)).filter(p => p > -1).reduce((a, b) => Math.min(a, b), text.length)
        : text.length;
      result.push({ heading: sections[i], body: text.slice(contentStart, end).trim() });
    }
    return result;
  };

  const downloadContacts = () => {
    const validations: any[] = idea?.validations || [];
    const interestedEmails = new Set((a.interestedContacts || []).map((c: any) => c.email));

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

    const buildRow = (v: any, showContact: boolean, idx: number) => {
      const mo = v.marketOpportunity; const fe = v.feasibility; const ff = v.founderFit;
      const rp = v.revenuePotential; const sc = v.scalability; const ia = v.investorAttractiveness;
      const inn = v.innovation; const si = v.socialImpact; const cv = v.customerValidation;
      const ra = v.riskAssessment; const st = v.sharkTank; const ss = v.startupSuccess;
      const of = v.openFeedback;
      const prefs: string[] = showContact
        ? JSON.parse(v.validator.validatorProfile?.contactPreferences || '[]') : [];
      return {
        // Identity
        'Validator': showContact ? v.validator.name : `Validator ${idx + 1}`,
        'Email': showContact ? v.validator.email : '(Anonymous)',
        'Occupation': showContact ? (v.validator.validatorProfile?.occupation || '') : '',
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

    // Sheet 2 — Validator Contacts & Full Scores (opted-in only)
    const contactRows = validations
      .filter((v: any) => interestedEmails.has(v.validator.email))
      .map((v: any, i: number) => buildRow(v, true, i));
    if (contactRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(contactRows);
      ws2['!cols'] = Object.keys(contactRows[0]).map(() => colW);
      XLSX.utils.book_append_sheet(wb, ws2, '2. Validator Contacts & Scores');
    }

    // Sheet 3 — All Validators Anonymized
    const allRows = validations.map((v: any, i: number) => buildRow(v, false, i));
    if (allRows.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(allRows);
      ws3['!cols'] = Object.keys(allRows[0]).map(() => colW);
      XLSX.utils.book_append_sheet(wb, ws3, '3. All Validator Scores');
    }

    // Sheet 4 — Risk Summary
    const riskRows = Object.entries(a.riskSummary || {}).map(([risk, counts]: any) => ({
      'Risk Type': risk.replace(/([A-Z])/g, ' $1').trim(),
      'Low Count': counts.LOW ?? 0,
      'Medium Count': counts.MEDIUM ?? 0,
      'High Count': counts.HIGH ?? 0,
    }));
    if (riskRows.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(riskRows);
      ws4['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws4, '4. Risk Summary');
    }

    const ideaTitle = (idea?.title || 'idea').replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `validation_report_${ideaTitle}.xlsx`);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{idea?.title}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-gray-500">{idea?.industryCategory}</span>
          <span className="text-sm text-gray-400">•</span>
          <span className="text-sm text-gray-500">{a.totalValidations || 0} validation{a.totalValidations !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {a.totalValidations === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 text-center">
          <p className="text-yellow-800 font-medium">No validations received yet. Check back later!</p>
        </div>
      )}

      {a.totalValidations > 0 && (
        <>
          {/* Overall scores */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-indigo-600 text-white rounded-xl p-6 text-center">
              <div className="text-4xl font-black mb-1">{(a.overallScore || 0).toFixed(0)}%</div>
              <div className="text-indigo-200 text-sm">Overall Score</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className={`text-3xl font-black mb-1 ${sh.color}`}>{(a.sharkTankAvg || 0).toFixed(0)}</div>
              <div className="text-gray-500 text-sm">Shark Tank Score / 100</div>
              <div className={`text-xs font-medium mt-1 ${sh.color}`}>{sh.label}</div>
            </div>
            <div className={`border rounded-xl p-6 text-center ${s.bg}`}>
              <div className={`text-3xl font-black mb-1 ${s.color}`}>{(a.startupSuccessAvg || 0).toFixed(0)}</div>
              <div className="text-gray-500 text-sm">Validation Score / 100</div>
              <div className={`text-xs font-semibold mt-1 ${s.color}`}>{s.label}</div>
            </div>
          </div>

          {/* Matrix Scores */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Matrix Scores (out of 50)</h3>
              <ScoreBar label="Market Opportunity" score={a.marketOpportunityAvg || 0} max={50} color="indigo" />
              <ScoreBar label="Feasibility" score={a.feasibilityAvg || 0} max={50} color="blue" />
              <ScoreBar label="Founder Fit" score={a.founderFitAvg || 0} max={50} color="purple" />
              <ScoreBar label="Revenue Potential" score={a.revenuePotentialAvg || 0} max={50} color="green" />
              <ScoreBar label="Scalability" score={a.scalabilityAvg || 0} max={50} color="yellow" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Additional Scores (out of 50)</h3>
              <ScoreBar label="Innovation" score={a.innovationAvg || 0} max={50} color="indigo" />
              <ScoreBar label="Social Impact" score={a.socialImpactAvg || 0} max={50} color="green" />
              <ScoreBar label="Investor Attractiveness" score={a.investorAttractivenessAvg || 0} max={50} color="blue" />
            </div>
          </div>

          {/* Customer Validation */}
          {a.customerValidation && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Customer Validation</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Would Use It', val: a.customerValidation.wouldUse },
                  { label: 'Would Pay', val: a.customerValidation.wouldPay },
                  { label: 'Would Recommend', val: a.customerValidation.wouldRecommend },
                  { label: 'Solves Real Problem', val: a.customerValidation.solvesRealProblem },
                  { label: 'Better Than Alternatives', val: a.customerValidation.betterThanAlternatives },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className={`text-2xl font-bold ${item.val >= 60 ? 'text-green-600' : item.val >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{item.val.toFixed(0)}%</div>
                    <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          {a.riskSummary && Object.keys(a.riskSummary).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Risk Assessment</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Risk Type</th>
                      <th className="pb-2 font-medium text-green-600">Low</th>
                      <th className="pb-2 font-medium text-yellow-600">Medium</th>
                      <th className="pb-2 font-medium text-red-600">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(a.riskSummary).map(([risk, counts]: any) => (
                      <tr key={risk} className="border-b border-gray-100">
                        <td className="py-2 capitalize text-gray-700">{risk.replace(/([A-Z])/g, ' $1')}</td>
                        <td className="py-2"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">{counts.LOW || 0}</span></td>
                        <td className="py-2"><span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">{counts.MEDIUM || 0}</span></td>
                        <td className="py-2"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">{counts.HIGH || 0}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-indigo-600">✦</span> AI Summary
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Powered by Groq AI — synthesises all validator scores and feedback</p>
              </div>
              {!aiSummary && (
                <button onClick={generateAiSummary} disabled={aiLoading}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60">
                  {aiLoading ? (
                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Generating...</>
                  ) : 'Generate AI Summary'}
                </button>
              )}
              {aiSummary && (
                <button onClick={() => { setAiSummary(''); setAiError(''); }} className="text-xs text-indigo-500 hover:underline">Regenerate</button>
              )}
            </div>

            {aiError && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{aiError}</div>}

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-indigo-400">
                <div className="animate-spin w-8 h-8 border-3 border-indigo-300 border-t-indigo-600 rounded-full mb-3 border-[3px]"></div>
                <p className="text-sm">Analysing your validation data...</p>
              </div>
            )}

            {aiSummary && (() => {
              const sections = parseSummary(aiSummary);
              const sectionMeta: Record<string, { icon: string; color: string; bg: string }> = {
                'VERDICT': { icon: '⚡', color: 'text-indigo-700', bg: 'bg-indigo-100' },
                "WHAT'S WORKING": { icon: '✓', color: 'text-green-700', bg: 'bg-green-100' },
                'WHAT NEEDS WORK': { icon: '!', color: 'text-amber-700', bg: 'bg-amber-100' },
                'NEXT STEPS': { icon: '→', color: 'text-blue-700', bg: 'bg-blue-100' },
              };
              return (
                <div className="space-y-4">
                  {sections.map(({ heading, body }) => {
                    const meta = sectionMeta[heading] || { icon: '•', color: 'text-gray-700', bg: 'bg-gray-100' };
                    return (
                      <div key={heading} className="bg-white rounded-lg p-4 border border-white/60">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full mb-2 ${meta.bg} ${meta.color}`}>
                          <span>{meta.icon}</span>{heading}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {!aiSummary && !aiLoading && !aiError && (
              <p className="text-sm text-gray-400 text-center py-4">Click &quot;Generate AI Summary&quot; to get an instant analysis of your validation results.</p>
            )}
          </div>

          {/* Feedback */}
          {a.openFeedbacks?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Validator Feedback</h3>
              <div className="space-y-4">
                {a.openFeedbacks.map((fb: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-3">Anonymous Validator</div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div><div className="text-xs font-medium text-green-600 mb-1">Biggest Strength</div><p className="text-sm text-gray-700">{fb.strength}</p></div>
                      <div><div className="text-xs font-medium text-red-600 mb-1">Biggest Weakness</div><p className="text-sm text-gray-700">{fb.weakness}</p></div>
                      <div><div className="text-xs font-medium text-blue-600 mb-1">Suggested Improvement</div><p className="text-sm text-gray-700">{fb.improvement}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interested Contacts */}
          {a.interestedContacts?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Interested Validators</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{a.interestedContacts.length} validator{a.interestedContacts.length !== 1 ? 's' : ''} open to being contacted</p>
                </div>
                <button onClick={downloadContacts}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download Full Report
                </button>
              </div>
              <div className="space-y-3">
                {a.interestedContacts.map((contact: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg p-4">
                    <div>
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-sm text-gray-500">{contact.occupation} • {contact.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(contact.contactPreferences) ? contact.contactPreferences : []).map((p: string) => (
                        <span key={p} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{p.replace('_', ' ')}</span>
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
