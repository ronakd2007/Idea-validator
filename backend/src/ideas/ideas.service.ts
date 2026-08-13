import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class IdeasService {
  constructor(private prisma: PrismaService, private activity: ActivityService) {}

  private async actor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    return { label: user?.name || 'Unknown user', role: user?.role || 'FOUNDER' };
  }

  async create(founderId: string, data: any) {
    const { selfAssessment, teamMembers, ...ideaData } = data;
    const idea = await this.prisma.idea.create({
      data: {
        ...ideaData,
        teamMembers: JSON.stringify(teamMembers || []),
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

  // The dashboard unlocks once the idea has enough validations to be
  // meaningful OR enough time has passed — whichever comes first. The timer
  // starts when payment completes (that's when validators can first see it),
  // falling back to submission time for anything without a completed payment.
  private static readonly UNLOCK_VALIDATION_COUNT = 3;
  private static readonly UNLOCK_AFTER_HOURS = 48;

  async getDashboard(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        founder: { select: { id: true, name: true } },
        selfAssessment: true,
        payments: { where: { status: 'COMPLETED' }, orderBy: { createdAt: 'asc' }, take: 1 },
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

    const liveSince = idea.payments[0]?.createdAt ?? idea.submittedAt;
    const unlockAt = new Date(liveSince.getTime() + IdeasService.UNLOCK_AFTER_HOURS * 60 * 60 * 1000);
    const unlocked =
      idea.validations.length >= IdeasService.UNLOCK_VALIDATION_COUNT || Date.now() >= unlockAt.getTime();

    if (!unlocked) {
      // Locked: return progress only — never the validations themselves, so
      // the gate can't be bypassed by reading the raw response.
      return {
        available: false,
        unlockAt,
        validationCount: idea.validations.length,
        validationsNeeded: IdeasService.UNLOCK_VALIDATION_COUNT,
        idea: { id: idea.id, title: idea.title, submittedAt: idea.submittedAt },
      };
    }

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
    const openFeedbacks = validations.filter(v => v.openFeedback).map(v => ({
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
        const prefs = JSON.parse(v.validator.validatorProfile?.contactPreferences || '[]');
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

    const { selfAssessment, teamMembers, ...ideaData } = data;
    const revision = await this.prisma.idea.create({
      data: {
        ...ideaData,
        teamMembers: JSON.stringify(teamMembers || []),
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
}
