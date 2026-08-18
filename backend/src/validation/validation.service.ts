import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class ValidationService {
  constructor(private prisma: PrismaService, private activity: ActivityService) {}

  private async actor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    return { label: user?.name || 'Unknown user', role: user?.role || 'VALIDATOR' };
  }

  /**
   * Recorded when a validator opens an idea to review it. Called from the
   * "have I already validated this?" check the validator's page makes on load,
   * which is the one point that reliably means "a validator opened this idea"
   * — this is not general page-view tracking.
   */
  async recordValidationOpened(ideaId: string, validatorId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, title: true, founderId: true },
    });
    if (!idea) return;

    // Refreshing the validation page must not fill the feed with duplicates —
    // one "opened" entry per validator per idea per hour is enough to be useful.
    const recent = await this.prisma.activity.findFirst({
      where: {
        userId: validatorId,
        action: 'VALIDATION_OPENED',
        targetType: 'IDEA',
        targetId: ideaId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) return;

    const { label, role } = await this.actor(validatorId);
    void this.activity.log({
      userId: validatorId,
      actorRole: role,
      actorLabel: label,
      action: 'VALIDATION_OPENED',
      targetType: 'IDEA',
      targetId: idea.id,
      targetLabel: idea.title,
      ownerUserId: idea.founderId,
      metadata: { ideaId: idea.id },
    });
  }

  async submitValidation(ideaId: string, validatorId: string, data: any) {
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.paymentStatus !== 'COMPLETED') throw new ForbiddenException('Idea is not yet active');

    const existing = await this.prisma.validationResponse.findUnique({
      where: { ideaId_validatorId: { ideaId, validatorId } },
    });
    if (existing) throw new ConflictException('You have already validated this idea');

    const {
      marketOpportunity, feasibility, founderFit, revenuePotential, scalability,
      riskAssessment, investorAttractiveness, innovation, socialImpact,
      customerValidation, sharkTank, startupSuccess, openFeedback,
    } = data;

    const created = await this.prisma.validationResponse.create({
      data: {
        ideaId,
        validatorId,
        marketOpportunity: marketOpportunity ? { create: marketOpportunity } : undefined,
        feasibility: feasibility ? { create: feasibility } : undefined,
        founderFit: founderFit ? { create: founderFit } : undefined,
        revenuePotential: revenuePotential ? { create: revenuePotential } : undefined,
        scalability: scalability ? { create: scalability } : undefined,
        riskAssessment: riskAssessment ? { create: riskAssessment } : undefined,
        investorAttractiveness: investorAttractiveness ? { create: investorAttractiveness } : undefined,
        innovation: innovation ? { create: innovation } : undefined,
        socialImpact: socialImpact ? { create: socialImpact } : undefined,
        customerValidation: customerValidation ? { create: customerValidation } : undefined,
        sharkTank: sharkTank ? { create: sharkTank } : undefined,
        startupSuccess: startupSuccess ? { create: startupSuccess } : undefined,
        openFeedback: openFeedback ? { create: openFeedback } : undefined,
      },
    });

    const { label, role } = await this.actor(validatorId);
    void this.activity.log({
      userId: validatorId,
      actorRole: role,
      actorLabel: label,
      action: 'VALIDATION_SUBMITTED',
      targetType: 'VALIDATION',
      targetId: created.id,
      targetLabel: idea.title,
      ownerUserId: idea.founderId,
      metadata: { validationId: created.id, ideaId },
    });

    return created;
  }

  async getValidatorHistory(validatorId: string) {
    return this.prisma.validationResponse.findMany({
      where: { validatorId },
      include: { idea: { select: { id: true, title: true, industryCategory: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkAlreadyValidated(ideaId: string, validatorId: string) {
    const existing = await this.prisma.validationResponse.findUnique({
      where: { ideaId_validatorId: { ideaId, validatorId } },
    });

    // Only counts as "opened a validation request" if they haven't already
    // submitted one — revisiting a finished validation isn't a new review.
    if (!existing) {
      await this.recordValidationOpened(ideaId, validatorId).catch(() => {});
    }

    return { alreadyValidated: !!existing };
  }

  /**
   * The founder rates how useful a review was: 1 = not helpful, 2 = somewhat,
   * 3 = very helpful. This is the quality gate for the incentive model — a
   * rushed review earns nothing — and it later feeds a validator's public
   * reputation. Only the founder who owns the idea can write it, and the
   * rating is never exposed to the validator from here.
   */
  async rateValidation(validationId: string, founderId: string, rating: number) {
    if (![1, 2, 3].includes(rating)) {
      throw new BadRequestException('Rating must be 1, 2 or 3.');
    }

    const validation = await this.prisma.validationResponse.findUnique({
      where: { id: validationId },
      select: { id: true, idea: { select: { founderId: true } } },
    });
    if (!validation) throw new NotFoundException('Review not found');
    if (validation.idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.validationResponse.update({
      where: { id: validationId },
      data: { helpfulRating: rating, ratedAt: new Date() },
      select: { id: true, helpfulRating: true },
    });
    return { success: true, validationId: updated.id, helpfulRating: updated.helpfulRating };
  }
}
