import { Injectable } from '@nestjs/common';
import { IdeasService } from '../ideas/ideas.service';
import { SurveyAnalyticsService } from '../survey/survey-analytics.service';

const RISK_LABELS: Record<string, string> = {
  competition: 'Competition',
  regulatory: 'Regulatory',
  technology: 'Technology',
  funding: 'Funding',
  marketAdoption: 'Market Adoption',
};

// Turns already-computed report data into a compact, information-dense text
// block for the LLM system prompt. Deliberately built from the SAME service
// methods the dashboard/analytics pages call (IdeasService.getDashboard,
// SurveyAnalyticsService.getAnalytics) — the assistant can never see numbers
// the founder's own report doesn't already show.
@Injectable()
export class ContextBuilderService {
  constructor(
    private ideasService: IdeasService,
    private surveyAnalytics: SurveyAnalyticsService,
  ) {}

  // Ownership is enforced by getDashboard/getBenchmark themselves (they throw
  // ForbiddenException on mismatch) — callers must let that exception propagate.
  async buildIdeaContext(ideaId: string, founderId: string): Promise<string> {
    const [{ idea, aggregated: a }, benchmark] = await Promise.all([
      this.ideasService.getDashboard(ideaId, founderId),
      this.ideasService.getBenchmark(ideaId, founderId).catch(() => null),
    ]);

    const lines: string[] = [];
    lines.push('=== IDEA VALIDATION REPORT (this is the founder\'s actual data — never invent numbers beyond this) ===');
    lines.push(`Title: ${idea.title}`);
    lines.push(`Industry: ${idea.industryCategory} | Stage: ${String(idea.stage).replace('_', ' ')}`);
    lines.push(`Problem: ${idea.problemStatement}`);
    lines.push(`Solution: ${idea.solutionDescription}`);
    lines.push(`Target Customer: ${idea.targetCustomer}`);
    lines.push(`Revenue Model: ${idea.revenueModel}`);
    if (idea.founderContext) lines.push(`Founder Context: ${idea.founderContext}`);

    if (!a.totalValidations) {
      lines.push('\nNo expert validations yet — the report has no scores or feedback to reference. Say so plainly if asked about scores.');
    } else {
      lines.push(`\nEXPERT VALIDATION (n=${a.totalValidations} expert reviewers):`);
      lines.push(`- Overall Score: ${a.overallScore?.toFixed(0)}/100`);
      lines.push(`- Shark Tank Score: ${a.sharkTankAvg?.toFixed(0)}/100`);
      lines.push(`- Validation Score: ${a.startupSuccessAvg?.toFixed(0)}/100`);
      lines.push('Category breakdown (each out of 50):');
      const categories: [string, number | undefined][] = [
        ['Market Opportunity', a.marketOpportunityAvg], ['Feasibility', a.feasibilityAvg],
        ['Founder Fit', a.founderFitAvg], ['Revenue Potential', a.revenuePotentialAvg],
        ['Scalability', a.scalabilityAvg], ['Innovation', a.innovationAvg],
        ['Social Impact', a.socialImpactAvg], ['Investor Attractiveness', a.investorAttractivenessAvg],
      ];
      for (const [label, val] of categories) {
        if (val != null) lines.push(`  - ${label}: ${val.toFixed(1)}/50`);
      }

      if (a.customerValidation) {
        lines.push('\nEXPERT-REPORTED CUSTOMER VALIDATION SIGNALS (opinions from expert reviewers, NOT real customers):');
        lines.push(`  - Would Use: ${a.customerValidation.wouldUse?.toFixed(0)}%`);
        lines.push(`  - Would Pay: ${a.customerValidation.wouldPay?.toFixed(0)}%`);
        lines.push(`  - Would Recommend: ${a.customerValidation.wouldRecommend?.toFixed(0)}%`);
        if (a.customerValidation.solvesRealProblem != null) lines.push(`  - Solves Real Problem: ${a.customerValidation.solvesRealProblem.toFixed(0)}%`);
        if (a.customerValidation.betterThanAlternatives != null) lines.push(`  - Better Than Alternatives: ${a.customerValidation.betterThanAlternatives.toFixed(0)}%`);
      }

      if (a.riskSummary && Object.keys(a.riskSummary).length) {
        lines.push('\nRISK ASSESSMENT (expert votes, count per level):');
        for (const [key, counts] of Object.entries<any>(a.riskSummary)) {
          lines.push(`  - ${RISK_LABELS[key] || key}: ${counts.LOW || 0} low, ${counts.MEDIUM || 0} medium, ${counts.HIGH || 0} high`);
        }
      }

      if (a.openFeedbacks?.length) {
        lines.push(`\nWRITTEN EXPERT FEEDBACK (${a.openFeedbacks.length} reviewer${a.openFeedbacks.length !== 1 ? 's' : ''}, quote these verbatim when citing evidence):`);
        for (const [i, fb] of a.openFeedbacks.slice(0, 12).entries()) {
          lines.push(`  [${i + 1}] Strength: "${fb.strength}" | Weakness: "${fb.weakness}" | Suggestion: "${fb.improvement}"`);
        }
      }
    }

    if (benchmark?.percentile != null) {
      lines.push(`\nBENCHMARK: scores higher than ${benchmark.percentile}% of ${benchmark.cohortSize} validated ideas on the platform` +
        (benchmark.industryPercentile != null ? `, and ${benchmark.industryPercentile}% within its own "${benchmark.industryCategory}" industry (${benchmark.industryCohortSize} ideas)` : '') + '.');
    }

    let assumptions: { statement: string; category?: string }[] = [];
    try {
      const parsed = JSON.parse(idea.assumptions || '[]');
      if (Array.isArray(parsed)) assumptions = parsed.filter((x: any) => x?.statement);
    } catch { /* corrupt JSON reads as no assumptions */ }
    if (assumptions.length) {
      lines.push(`\nFOUNDER-DEFINED ASSUMPTIONS (${assumptions.length} — beliefs the founder has NOT yet had verdicted; you can reason about whether the evidence above supports or contradicts each one):`);
      for (const [i, as] of assumptions.entries()) {
        lines.push(`  [${i + 1}] "${as.statement}"${as.category ? ` (${as.category})` : ''}`);
      }
    }

    if (idea.aiSummary) {
      lines.push('\nEXISTING AI-GENERATED REPORT SUMMARY (already shown to the founder on their dashboard):');
      lines.push(idea.aiSummary);
    }

    return lines.join('\n');
  }

  // Ownership enforced by getAnalytics itself (ForbiddenException on mismatch).
  async buildSurveyContext(surveyId: string, founderId: string): Promise<string> {
    const d: any = await this.surveyAnalytics.getAnalytics(surveyId, founderId, {});

    const lines: string[] = [];
    lines.push('=== SURVEY REPORT (this is the founder\'s actual data — never invent numbers beyond this) ===');
    lines.push(`Survey: "${d.survey.title}" | Status: ${d.survey.status}${d.survey.ideaTitle ? ` | Linked idea: "${d.survey.ideaTitle}"` : ' | Standalone survey'}`);
    lines.push(`Total Responses: ${d.summary.totalResponses} (${d.sampleSizeLabel})`);
    if (d.summary.completionRate != null) lines.push(`Completion Rate: ${d.summary.completionRate.toFixed(0)}% (${d.activity.started} started, ${d.activity.completed} completed, ${d.activity.abandoned} abandoned)`);
    lines.push(`Avg. Completion Time: ${d.summary.avgCompletionTime}`);
    if (d.summary.qualityHighPct != null) {
      lines.push(`Response Quality: ${d.quality.buckets.HIGH || 0} high, ${d.quality.buckets.MEDIUM || 0} medium, ${d.quality.buckets.POTENTIALLY_LOW || 0} potentially low quality (out of ${d.quality.total})`);
    }

    if (d.insights?.length) {
      lines.push('\nKEY INSIGHTS (already computed and shown to the founder):');
      for (const ins of d.insights) lines.push(`  - [${ins.tone}] ${ins.title}: ${ins.body}`);
    }

    if (d.questions?.length) {
      lines.push('\nQUESTION-BY-QUESTION BREAKDOWN:');
      for (const q of d.questions) {
        lines.push(`  Q: "${q.questionText}" (${q.type}, ${q.answeredCount} answered)`);
        if (q.distribution) {
          for (const opt of q.distribution.slice(0, 8)) lines.push(`    - ${opt.label}: ${opt.count} (${opt.pct.toFixed(0)}%)`);
        } else if (q.average != null) {
          lines.push(`    - Average: ${q.average.toFixed(1)}/${q.max}`);
        }
      }
    }

    if (d.dropOff?.length > 1) {
      lines.push('\nQUESTION DROP-OFF (% of starters who reached each question):');
      for (const [i, dp] of d.dropOff.entries()) lines.push(`  Q${i + 1}: ${dp.reachedPct.toFixed(0)}%`);
    }

    if (d.segmentation) {
      lines.push(`\nSEGMENTATION by "${d.segmentation.segmentQuestionText}"${d.segmentation.outcomeQuestionText ? ` vs "${d.segmentation.outcomeQuestionText}"` : ''}:`);
      for (const seg of d.segmentation.segments) {
        lines.push(`  - ${seg.label}: ${seg.responseCount} responses${seg.outcome?.value != null ? `, outcome ${seg.outcome.type === 'percent' ? seg.outcome.value.toFixed(0) + '%' : seg.outcome.value.toFixed(1) + '/' + seg.outcome.max}` : ''}`);
      }
    }

    if (d.impact) {
      lines.push(`\nQUESTION IMPACT on "${d.impact.outcomeQuestionText}":`);
      for (const f of d.impact.factors) {
        lines.push(`  - "${f.questionText}": ${f.strength || f.result} (n=${f.sampleSize})`);
      }
    }

    if (d.abResults?.length) {
      lines.push('\nA/B TEST RESULTS:');
      for (const ab of d.abResults) {
        lines.push(`  - Variant A "${ab.variantA.questionText}" (n=${ab.variantA.n}) vs Variant B "${ab.variantB.questionText}" (n=${ab.variantB.n}) — ${ab.note}`);
      }
    }

    return lines.join('\n');
  }
}
