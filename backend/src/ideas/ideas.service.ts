import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { SurveyAnalyticsService } from '../survey/survey-analytics.service';

// Which sections a founder exposes on their idea's public validation page.
// Problem/solution default OFF — the pitch itself is the founder's IP; scores
// and aggregate evidence are what a public "proof of validation" needs.
export const SHARE_DEFAULTS = {
  showProblem: false,
  showSolution: false,
  showScores: true,
  showStrengthsRisks: true,
  showAiInsight: true,
  showCounts: true,
};

// Labels for the public strengths/risks bullets — mirrors the dashboard's
// MATRIX_CATEGORIES so both surfaces describe categories with the same words.
const CATEGORY_LABELS: { key: string; label: string }[] = [
  { key: 'marketOpportunityAvg', label: 'Market opportunity' },
  { key: 'feasibilityAvg', label: 'Feasibility' },
  { key: 'founderFitAvg', label: 'Founder fit' },
  { key: 'revenuePotentialAvg', label: 'Revenue potential' },
  { key: 'scalabilityAvg', label: 'Scalability' },
  { key: 'innovationAvg', label: 'Innovation' },
  { key: 'socialImpactAvg', label: 'Social impact' },
  { key: 'investorAttractivenessAvg', label: 'Investor attractiveness' },
];

@Injectable()
export class IdeasService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private surveyAnalytics: SurveyAnalyticsService,
  ) {}

  private async actor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    return { label: user?.name || 'Unknown user', role: user?.role || 'FOUNDER' };
  }

  async create(founderId: string, data: any) {
    const { selfAssessment, teamMembers, assumptions, ...ideaData } = data;
    const idea = await this.prisma.idea.create({
      data: {
        ...ideaData,
        teamMembers: JSON.stringify(teamMembers || []),
        assumptions: JSON.stringify((assumptions || []).filter((x: any) => x?.statement?.trim())),
        founderId,
        paymentStatus: 'PENDING',
        selfAssessment: selfAssessment ? { create: selfAssessment } : undefined,
      },
      include: { selfAssessment: true },
    });

    const { label, role } = await this.actor(founderId);
    void this.activity.log({
      userId: founderId,
      actorRole: role,
      actorLabel: label,
      action: 'IDEA_CREATED',
      targetType: 'IDEA',
      targetId: idea.id,
      targetLabel: idea.title,
      ownerUserId: founderId,
      metadata: { ideaId: idea.id, industryCategory: idea.industryCategory, stage: idea.stage },
    });

    return idea;
  }

  async findAllForValidator() {
    return this.prisma.idea.findMany({
      where: { paymentStatus: 'COMPLETED' },
      include: {
        founder: { select: { id: true, name: true } },
        selfAssessment: true,
        _count: { select: { validations: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findMyIdeas(founderId: string) {
    return this.prisma.idea.findMany({
      where: { founderId },
      include: {
        selfAssessment: true,
        _count: { select: { validations: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requester: { userId: string; role: string }) {
    const idea = await this.prisma.idea.findUnique({
      where: { id },
      include: {
        founder: { select: { id: true, name: true } },
        selfAssessment: true,
        _count: { select: { validations: true } },
      },
    });
    if (!idea) throw new NotFoundException('Idea not found');

    // A full pitch (problem, solution, revenue model, team LinkedIn profiles)
    // is confidential: founders see only their own ideas, validators only see
    // ideas that are live for review. NotFound, not Forbidden, so the check
    // never confirms to outsiders that a given idea id exists.
    if (requester.role === 'FOUNDER' && idea.founderId !== requester.userId) {
      throw new NotFoundException('Idea not found');
    }
    if (requester.role === 'VALIDATOR' && idea.paymentStatus !== 'COMPLETED') {
      throw new NotFoundException('Idea not found');
    }
    return idea;
  }

  // The dashboard is available immediately after submission — the 48-hour
  // unlock gate (and its env/admin overrides) was removed by explicit product
  // decision on 2026-08-13. Validations simply appear as they arrive.
  async getDashboard(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        founder: { select: { id: true, name: true } },
        selfAssessment: true,
        validations: {
          include: {
            validator: { select: { id: true, name: true, email: true, phone: true, validatorProfile: true } },
            marketOpportunity: true,
            feasibility: true,
            founderFit: true,
            revenuePotential: true,
            scalability: true,
            riskAssessment: true,
            investorAttractiveness: true,
            innovation: true,
            socialImpact: true,
            customerValidation: true,
            sharkTank: true,
            startupSuccess: true,
            openFeedback: true,
          },
        },
      },
    });

    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    const { label, role } = await this.actor(founderId);
    void this.activity.log({
      userId: founderId,
      actorRole: role,
      actorLabel: label,
      action: 'IDEA_RESULTS_VIEWED',
      targetType: 'IDEA',
      targetId: idea.id,
      targetLabel: idea.title,
      ownerUserId: founderId,
      metadata: { ideaId: idea.id, validationCount: idea.validations.length },
    });

    return { available: true, idea, aggregated: this.aggregateScores(idea.validations) };
  }

  /**
   * Admin-only view of the same dashboard payload, without the founder
   * ownership check. Reached only through an ADMIN-guarded route; deliberately
   * does not log an IDEA_RESULTS_VIEWED activity against the founder, since
   * the founder did not do it — the admin's own action is logged by the caller.
   */
  async getDashboardForAdmin(ideaId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        founder: { select: { id: true, name: true, email: true, createdAt: true } },
        selfAssessment: true,
        validations: {
          orderBy: { createdAt: 'desc' },
          include: {
            validator: { select: { id: true, name: true, email: true, phone: true, validatorProfile: true } },
            marketOpportunity: true,
            feasibility: true,
            founderFit: true,
            revenuePotential: true,
            scalability: true,
            riskAssessment: true,
            investorAttractiveness: true,
            innovation: true,
            socialImpact: true,
            customerValidation: true,
            sharkTank: true,
            startupSuccess: true,
            openFeedback: true,
          },
        },
        surveys: {
          select: { id: true, title: true, status: true, createdAt: true, _count: { select: { responses: true } } },
          orderBy: { createdAt: 'desc' },
        },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!idea) throw new NotFoundException('Idea not found');
    return { available: true, idea, aggregated: this.aggregateScores(idea.validations) };
  }

  private avg(arr: number[]) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  private pct(arr: boolean[]) {
    return arr.length ? (arr.filter(Boolean).length / arr.length) * 100 : 0;
  }

  private aggregateScores(validations: any[]) {
    if (!validations.length) return { totalValidations: 0 };

    const sum5 = (obj: any, keys: string[]) => keys.reduce((s, k) => s + (obj[k] || 0), 0);

    const marketScores = validations.filter(v => v.marketOpportunity).map(v =>
      sum5(v.marketOpportunity, ['problemSeverity', 'marketSize', 'willingnessToPay', 'marketGrowthRate', 'competitionGap']));
    const feasScores = validations.filter(v => v.feasibility).map(v =>
      sum5(v.feasibility, ['technicalComplexity', 'capitalRequirement', 'regulatoryDifficulty', 'talentAvailability', 'timeToLaunch']));
    const founderScores = validations.filter(v => v.founderFit).map(v =>
      sum5(v.founderFit, ['industryKnowledge', 'relevantExperience', 'networkAccess', 'passion', 'skillAlignment']));
    const revenueScores = validations.filter(v => v.revenuePotential).map(v =>
      sum5(v.revenuePotential, ['pricingPower', 'recurringRevenuePotential', 'profitMarginPotential', 'upsellOpportunities', 'customerLifetimeValue']));
    const scaleScores = validations.filter(v => v.scalability).map(v =>
      sum5(v.scalability, ['geographicExpansion', 'automationPotential', 'operationalComplexity', 'dependenceOnFounder', 'networkEffects']));
    const innovScores = validations.filter(v => v.innovation).map(v =>
      sum5(v.innovation, ['uniqueness', 'patentability', 'competitiveAdvantage', 'disruptionPotential', 'defensibility']));
    const socialScores = validations.filter(v => v.socialImpact).map(v =>
      sum5(v.socialImpact, ['jobCreation', 'environmentalBenefit', 'communityBenefit', 'inclusion', 'sustainability']));
    const investorScores = validations.filter(v => v.investorAttractiveness).map(v =>
      sum5(v.investorAttractiveness, ['marketSize', 'growthPotential', 'scalability', 'exitPotential', 'defensibility']));

    const sharkScores = validations.filter(v => v.sharkTank).map(v =>
      (v.sharkTank.problemImportance / 10) * 25 + (v.sharkTank.marketSize / 10) * 20 +
      (v.sharkTank.revenuePotential / 10) * 20 + (v.sharkTank.executionEase / 10) * 15 +
      (v.sharkTank.scalability / 10) * 20);

    // Weighted formula: Team 25% + Market 20% + Product 15% + Traction 15% + BizModel 10% + Competition 5% + Timing 5% + Funding 5%
    const successScores = validations.filter(v => v.startupSuccess).map(v =>
      (v.startupSuccess.founderTeam / 10) * 25 +
      (v.startupSuccess.marketSize / 10) * 20 +
      (v.startupSuccess.productDifferentiation / 10) * 15 +
      (v.startupSuccess.traction / 10) * 15 +
      (v.startupSuccess.businessModel / 10) * 10 +
      (v.startupSuccess.competition / 10) * 5 +
      (v.startupSuccess.timing / 10) * 5 +
      (v.startupSuccess.fundingReadiness / 10) * 5);

    const cvList = validations.filter(v => v.customerValidation);

    const riskSummary: any = {};
    validations.filter(v => v.riskAssessment).forEach(v => {
      const ra = v.riskAssessment;
      ['competition', 'regulatory', 'technology', 'funding', 'marketAdoption'].forEach(risk => {
        if (!riskSummary[risk]) riskSummary[risk] = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        riskSummary[risk][ra[`${risk}Probability`]]++;
      });
    });

    // A validator's contact details are shared with the founder the moment they
    // submit a validation — not gated behind their contactPreferences opt-in,
    // which only governs the separate "open to further contact" signal below.
    // v.validator is optional-chained throughout: some callers (version history,
    // the public page) aggregate score relations without loading validator rows.
    const openFeedbacks = validations.filter(v => v.openFeedback && v.validator).map(v => ({
      strength: v.openFeedback.biggestStrength,
      weakness: v.openFeedback.biggestWeakness,
      improvement: v.openFeedback.suggestedImprovement,
      validatorName: v.validator.name,
      validatorEmail: v.validator.email,
      validatorPhone: v.validator.phone,
      validatorLinkedinUrl: v.validator.validatorProfile?.linkedinUrl || null,
      validatorOccupation: v.validator.validatorProfile?.occupation || null,
    }));

    const interestedContacts = validations
      .filter(v => {
        const prefs = JSON.parse(v.validator?.validatorProfile?.contactPreferences || '[]');
        return Array.isArray(prefs) && prefs.length > 0;
      })
      .map(v => ({
        name: v.validator.name,
        email: v.validator.email,
        contactPreferences: JSON.parse(v.validator.validatorProfile?.contactPreferences || '[]'),
        occupation: v.validator.validatorProfile?.occupation,
      }));

    const normalizedScores = [
      marketScores.length ? (this.avg(marketScores) / 50) * 100 : null,
      feasScores.length ? (this.avg(feasScores) / 50) * 100 : null,
      founderScores.length ? (this.avg(founderScores) / 50) * 100 : null,
      revenueScores.length ? (this.avg(revenueScores) / 50) * 100 : null,
      scaleScores.length ? (this.avg(scaleScores) / 50) * 100 : null,
      innovScores.length ? (this.avg(innovScores) / 50) * 100 : null,
      socialScores.length ? (this.avg(socialScores) / 50) * 100 : null,
    ].filter(s => s !== null) as number[];

    return {
      totalValidations: validations.length,
      overallScore: this.avg(normalizedScores),
      marketOpportunityAvg: this.avg(marketScores),
      feasibilityAvg: this.avg(feasScores),
      founderFitAvg: this.avg(founderScores),
      revenuePotentialAvg: this.avg(revenueScores),
      scalabilityAvg: this.avg(scaleScores),
      innovationAvg: this.avg(innovScores),
      socialImpactAvg: this.avg(socialScores),
      investorAttractivenessAvg: this.avg(investorScores),
      sharkTankAvg: this.avg(sharkScores),
      startupSuccessAvg: this.avg(successScores),
      customerValidation: {
        wouldUse: this.pct(cvList.map(v => v.customerValidation.wouldUse)),
        wouldPay: this.pct(cvList.map(v => v.customerValidation.wouldPay)),
        wouldRecommend: this.pct(cvList.map(v => v.customerValidation.wouldRecommend)),
        solvesRealProblem: this.pct(cvList.map(v => v.customerValidation.solvesRealProblem)),
        betterThanAlternatives: this.pct(cvList.map(v => v.customerValidation.betterThanAlternatives)),
      },
      riskSummary,
      openFeedbacks,
      interestedContacts,
    };
  }

  async createRevision(originalIdeaId: string, founderId: string, data: any) {
    const original = await this.prisma.idea.findUnique({ where: { id: originalIdeaId } });
    if (!original) throw new NotFoundException('Original idea not found');
    if (original.founderId !== founderId) throw new ForbiddenException('Access denied');

    const { selfAssessment, teamMembers, assumptions, ...ideaData } = data;
    const revision = await this.prisma.idea.create({
      data: {
        ...ideaData,
        teamMembers: JSON.stringify(teamMembers || []),
        assumptions: JSON.stringify((assumptions || []).filter((x: any) => x?.statement?.trim())),
        founderId,
        isRevision: true,
        revisionOf: originalIdeaId,
        version: original.version + 1,
        paymentStatus: 'PENDING',
        selfAssessment: selfAssessment ? { create: selfAssessment } : undefined,
      },
      include: { selfAssessment: true },
    });

    const { label, role } = await this.actor(founderId);
    void this.activity.log({
      userId: founderId,
      actorRole: role,
      actorLabel: label,
      action: 'IDEA_REVISED',
      targetType: 'IDEA',
      targetId: revision.id,
      targetLabel: revision.title,
      ownerUserId: founderId,
      metadata: { ideaId: revision.id, revisionOf: originalIdeaId, version: revision.version },
    });

    return revision;
  }

  /**
   * Recorded when the founder generates the validation PDF. The report itself
   * is built client-side from data already on the page, so this endpoint exists
   * only to note that it happened — it returns nothing and stores no file.
   */
  async recordReportDownload(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, title: true, founderId: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    const { label, role } = await this.actor(founderId);
    void this.activity.log({
      userId: founderId,
      actorRole: role,
      actorLabel: label,
      action: 'REPORT_DOWNLOADED',
      targetType: 'IDEA',
      targetId: idea.id,
      targetLabel: idea.title,
      ownerUserId: founderId,
      metadata: { ideaId: idea.id },
    });

    return { success: true };
  }

  // ---------- public validation page (share) ----------

  private generatePublicId() {
    return randomBytes(9).toString('base64url');
  }

  private async uniquePublicId(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const id = this.generatePublicId();
      const exists = await this.prisma.idea.findUnique({ where: { publicId: id } });
      if (!exists) return id;
    }
    throw new Error('Could not generate a unique public idea id');
  }

  private async findOwned(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');
    return idea;
  }

  private parseShareSettings(raw: string | null | undefined) {
    try {
      return { ...SHARE_DEFAULTS, ...(JSON.parse(raw || '{}') || {}) };
    } catch {
      return { ...SHARE_DEFAULTS };
    }
  }

  // Only the keys in SHARE_DEFAULTS survive, and only as booleans — a crafted
  // payload can't smuggle extra data into the stored settings JSON.
  private sanitizeShareSettings(input: any) {
    const clean: Record<string, boolean> = {};
    for (const key of Object.keys(SHARE_DEFAULTS)) {
      if (input && typeof input[key] === 'boolean') clean[key] = input[key];
    }
    return clean;
  }

  async enableShare(ideaId: string, founderId: string, settings?: any) {
    const idea = await this.findOwned(ideaId, founderId);
    const publicId = idea.publicId || (await this.uniquePublicId());
    const merged = { ...this.parseShareSettings(idea.publicShareSettings), ...this.sanitizeShareSettings(settings) };
    const updated = await this.prisma.idea.update({
      where: { id: ideaId },
      data: { publicId, publicShareEnabled: true, publicShareSettings: JSON.stringify(merged) },
      select: { publicId: true, publicShareEnabled: true, publicShareSettings: true },
    });
    return { ...updated, publicShareSettings: this.parseShareSettings(updated.publicShareSettings) };
  }

  async updateShareSettings(ideaId: string, founderId: string, settings: any) {
    const idea = await this.findOwned(ideaId, founderId);
    const merged = { ...this.parseShareSettings(idea.publicShareSettings), ...this.sanitizeShareSettings(settings) };
    const updated = await this.prisma.idea.update({
      where: { id: ideaId },
      data: { publicShareSettings: JSON.stringify(merged) },
      select: { publicId: true, publicShareEnabled: true, publicShareSettings: true },
    });
    return { ...updated, publicShareSettings: this.parseShareSettings(updated.publicShareSettings) };
  }

  // Disabling keeps the publicId, so re-enabling restores the same link.
  async disableShare(ideaId: string, founderId: string) {
    await this.findOwned(ideaId, founderId);
    await this.prisma.idea.update({ where: { id: ideaId }, data: { publicShareEnabled: false } });
    return { success: true };
  }

  private dominantRiskLevel(riskSummary: Record<string, { LOW: number; MEDIUM: number; HIGH: number }>): string | null {
    const risks = Object.values(riskSummary || {});
    if (!risks.length) return null;
    const order = ['LOW', 'MEDIUM', 'HIGH'];
    let worst = 0;
    for (const counts of risks) {
      // dominant level for this risk type = the most-voted level (ties -> the riskier one)
      let level = 0;
      let best = -1;
      order.forEach((l, i) => {
        const c = counts[l as keyof typeof counts] || 0;
        if (c >= best) { best = c; level = i; }
      });
      if (level > worst) worst = level;
    }
    return order[worst];
  }

  // First 1-2 sentences of the stored AI summary's VERDICT section — the only
  // AI text the public page ever shows.
  private extractAiInsight(aiSummary: string | null): string | null {
    if (!aiSummary) return null;
    const match = aiSummary.match(/VERDICT\s*\n+([\s\S]*?)(?=\n\s*(WHAT'S WORKING|WHAT NEEDS WORK|NEXT STEPS)|$)/i);
    const body = (match?.[1] || '').replace(/\*\*/g, '').trim();
    if (!body) return null;
    const sentences = body.match(/[^.!?]+[.!?]+/g) || [body];
    return sentences.slice(0, 2).join(' ').trim();
  }

  /**
   * Everything on the public page is aggregate or founder-approved. Built as
   * an explicit whitelist — no idea/validator/founder object is ever spread
   * into the response, so adding DB fields later can't silently leak here.
   */
  // ---------- assumption checker ----------

  /**
   * Replaces the idea's assumption list. Assumptions are the founder's own
   * hypotheses — statuses are never stored, they're computed client-side
   * against live evidence. An empty array is a valid way to clear them.
   */
  async updateAssumptions(ideaId: string, founderId: string, assumptions: { statement: string; category?: string }[]) {
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId }, select: { founderId: true } });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    const clean = (assumptions || [])
      .filter((a) => a?.statement?.trim())
      .map((a) => ({ statement: a.statement.trim(), category: a.category || null }));

    await this.prisma.idea.update({ where: { id: ideaId }, data: { assumptions: JSON.stringify(clean) } });
    return { assumptions: clean };
  }

  // ---------- percentile benchmarking ----------

  // The 7 relations that feed the overall score — the only data the
  // benchmark cohort query needs to load per idea.
  private static readonly SCORE_RELATIONS = {
    marketOpportunity: true, feasibility: true, founderFit: true, revenuePotential: true,
    scalability: true, innovation: true, socialImpact: true,
  } as const;

  /**
   * Overall score from minimal includes. MUST mirror aggregateScores()'s
   * normalizedScores math exactly (avg of per-category normalized averages) —
   * the e2e suite asserts benchmark score === dashboard overallScore so any
   * divergence fails loudly.
   */
  private leanOverallScore(validations: any[]): number | null {
    if (!validations.length) return null;
    const sum5 = (obj: any, keys: string[]) => keys.reduce((s, k) => s + (obj[k] || 0), 0);
    const per = (rel: string, keys: string[]) => {
      const arr = validations.filter((v) => v[rel]).map((v) => sum5(v[rel], keys));
      return arr.length ? (this.avg(arr) / 50) * 100 : null;
    };
    const parts = [
      per('marketOpportunity', ['problemSeverity', 'marketSize', 'willingnessToPay', 'marketGrowthRate', 'competitionGap']),
      per('feasibility', ['technicalComplexity', 'capitalRequirement', 'regulatoryDifficulty', 'talentAvailability', 'timeToLaunch']),
      per('founderFit', ['industryKnowledge', 'relevantExperience', 'networkAccess', 'passion', 'skillAlignment']),
      per('revenuePotential', ['pricingPower', 'recurringRevenuePotential', 'profitMarginPotential', 'upsellOpportunities', 'customerLifetimeValue']),
      per('scalability', ['geographicExpansion', 'automationPotential', 'operationalComplexity', 'dependenceOnFounder', 'networkEffects']),
      per('innovation', ['uniqueness', 'patentability', 'competitiveAdvantage', 'disruptionPotential', 'defensibility']),
      per('socialImpact', ['jobCreation', 'environmentalBenefit', 'communityBenefit', 'inclusion', 'sustainability']),
    ].filter((x): x is number => x != null);
    return parts.length ? this.avg(parts) : null;
  }

  /**
   * Where this idea's score sits among every other validated idea on the
   * platform. Deterministic, aggregates only — no other founder's idea is
   * ever identified. Percentiles are withheld below minimum cohort sizes
   * rather than reported on meaningless samples.
   */
  private async computeBenchmark(ideaId: string, industryCategory: string, myScore: number | null) {
    const MIN_OVERALL = 5;
    const MIN_INDUSTRY = 3;

    const others = await this.prisma.idea.findMany({
      where: { id: { not: ideaId }, paymentStatus: 'COMPLETED', validations: { some: {} } },
      select: {
        industryCategory: true,
        validations: { select: { ...IdeasService.SCORE_RELATIONS } },
      },
    });
    const cohort = others
      .map((o) => ({ industry: o.industryCategory, score: this.leanOverallScore(o.validations) }))
      .filter((s): s is { industry: string; score: number } => s.score != null);

    const industryCohort = cohort.filter((s) => s.industry === industryCategory);
    const pct = (group: { score: number }[]) =>
      myScore == null || !group.length ? null : Math.round((group.filter((s) => s.score < myScore).length / group.length) * 100);

    return {
      score: myScore != null ? Math.round(myScore) : null,
      percentile: cohort.length >= MIN_OVERALL ? pct(cohort) : null,
      cohortSize: cohort.length,
      industryCategory,
      industryPercentile: industryCohort.length >= MIN_INDUSTRY ? pct(industryCohort) : null,
      industryCohortSize: industryCohort.length,
    };
  }

  async getBenchmark(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: {
        founderId: true,
        industryCategory: true,
        validations: { select: { ...IdeasService.SCORE_RELATIONS } },
      },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    return this.computeBenchmark(ideaId, idea.industryCategory, this.leanOverallScore(idea.validations));
  }

  async getPublicIdea(publicId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { publicId },
      include: {
        validations: {
          include: {
            validator: { select: { id: true, name: true, email: true, phone: true, validatorProfile: true } },
            marketOpportunity: true, feasibility: true, founderFit: true, revenuePotential: true,
            scalability: true, riskAssessment: true, investorAttractiveness: true, innovation: true,
            socialImpact: true, customerValidation: true, sharkTank: true, startupSuccess: true, openFeedback: true,
          },
        },
        surveys: { select: { id: true, status: true, _count: { select: { responses: true } } } },
      },
    });
    if (!idea || !idea.publicShareEnabled) throw new NotFoundException('This validation page is not available');

    const settings = this.parseShareSettings(idea.publicShareSettings);
    const a: any = this.aggregateScores(idea.validations);
    const validationCount = idea.validations.length;
    const overallScore = Math.round(a.overallScore || 0);

    // Customer evidence: the linked survey with the most responses.
    const surveysWithResponses = idea.surveys.filter((s) => s._count.responses > 0);
    let customer: { positivePct: number | null; responses: number } | null = null;
    const totalResponses = surveysWithResponses.reduce((sum, s) => sum + s._count.responses, 0);
    if (surveysWithResponses.length) {
      const top = [...surveysWithResponses].sort((x, y) => y._count.responses - x._count.responses)[0];
      try {
        const analytics = await this.surveyAnalytics.getAnalytics(top.id, null, {});
        const primary = analytics.eligibleOutcomeQuestions[0];
        let positivePct: number | null = null;
        if (primary) {
          const qa: any = analytics.questions.find((q: any) => q.id === primary.id);
          if (primary.type === 'YES_NO') {
            const yes = qa?.distribution?.find((d: any) => d.label === 'Yes');
            positivePct = yes ? yes.pct : null;
          } else if (qa?.average != null) {
            positivePct = (qa.average / qa.max) * 100;
          }
        }
        customer = { positivePct: positivePct != null ? Math.round(positivePct) : null, responses: totalResponses };
      } catch {
        customer = { positivePct: null, responses: totalResponses };
      }
    }

    // Strengths/risks from the same category averages the dashboard shows.
    const cats = CATEGORY_LABELS
      .map((c) => ({ label: c.label, pct: ((a[c.key] || 0) / 50) * 100 }))
      .filter((c) => c.pct > 0)
      .sort((x, y) => y.pct - x.pct);
    const strengths = cats.slice(0, 3).filter((c) => c.pct >= 55).map((c) => `Strong ${c.label.toLowerCase()}`);
    const risks = cats.slice(-2).filter((c) => c.pct < 55).map((c) => `${c.label} needs strengthening`);
    const riskLevel = this.dominantRiskLevel(a.riskSummary);

    const recommendation =
      validationCount === 0 ? 'VALIDATION IN PROGRESS'
      : overallScore >= 70 ? 'CONTINUE — STRONG SIGNAL'
      : overallScore >= 40 ? 'IMPROVE & RE-VALIDATE'
      : 'HIGH RISK — RECONSIDER';

    return {
      title: idea.title,
      industryCategory: idea.industryCategory,
      stage: idea.stage,
      version: idea.version,
      status: validationCount >= 3 ? 'VALIDATED' : 'VALIDATION IN PROGRESS',
      submittedAt: idea.submittedAt,
      problem: settings.showProblem ? idea.problemStatement : null,
      solution: settings.showSolution ? idea.solutionDescription : null,
      scores: settings.showScores
        ? {
            overall: overallScore,
            expert: overallScore,
            customerPositivePct: customer?.positivePct ?? null,
            riskLevel,
          }
        : null,
      benchmark: settings.showScores
        ? await this.computeBenchmark(idea.id, idea.industryCategory, this.leanOverallScore(idea.validations))
        : null,
      counts: settings.showCounts
        ? { validators: validationCount, responses: totalResponses }
        : null,
      strengths: settings.showStrengthsRisks ? strengths : null,
      risks: settings.showStrengthsRisks ? risks : null,
      aiInsight: settings.showAiInsight ? this.extractAiInsight(idea.aiSummary) : null,
      recommendation,
    };
  }

  // ---------- version history ----------

  /**
   * The whole revision family of an idea: walk up `revisionOf` to the root,
   * then collect descendants. Chains are short (a founder revises a handful of
   * times at most), so the loop queries are fine.
   */
  async getVersions(ideaId: string, founderId: string) {
    const start = await this.findOwned(ideaId, founderId);

    let root = start;
    for (let i = 0; i < 20 && root.revisionOf; i++) {
      const parent = await this.prisma.idea.findUnique({ where: { id: root.revisionOf } });
      if (!parent) break;
      root = parent;
    }

    const familyIds = new Set<string>([root.id]);
    let frontier = [root.id];
    for (let i = 0; i < 20 && frontier.length; i++) {
      const children = await this.prisma.idea.findMany({
        where: { revisionOf: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id).filter((id) => !familyIds.has(id));
      frontier.forEach((id) => familyIds.add(id));
    }

    const versions = await this.prisma.idea.findMany({
      where: { id: { in: [...familyIds] }, founderId },
      include: {
        validations: {
          include: {
            marketOpportunity: true, feasibility: true, founderFit: true, revenuePotential: true,
            scalability: true, innovation: true, socialImpact: true,
          },
        },
      },
      orderBy: { version: 'asc' },
    });

    return versions.map((v) => {
      const agg: any = this.aggregateScores(v.validations as any[]);
      return {
        id: v.id,
        version: v.version,
        title: v.title,
        createdAt: v.createdAt,
        paymentStatus: v.paymentStatus,
        totalValidations: v.validations.length,
        overallScore: v.validations.length ? Math.round(agg.overallScore || 0) : null,
        isCurrent: v.id === ideaId,
      };
    });
  }
}
