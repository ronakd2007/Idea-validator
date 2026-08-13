import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { invalidateUser } from '../auth/user-cache';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private activity: ActivityService) {}

  // Admin moderation actions are recorded in the same log as everyone else's,
  // so the feed is a complete account of what happened on the platform.
  private async logAdmin(
    adminId: string,
    action: string,
    target: { type: string; id: string; label: string },
    metadata: Record<string, any> = {}
  ) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { name: true } });
    void this.activity.log({
      userId: adminId,
      actorRole: 'ADMIN',
      actorLabel: admin?.name || 'Admin',
      action,
      targetType: target.type,
      targetId: target.id,
      targetLabel: target.label,
      metadata,
    });
  }

  async getUsers(role?: string) {
    const users = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      include: { validatorProfile: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ password, ...u }) => u);
  }

  async getPendingValidators() {
    // rejectedAt keeps rejected applications out of this queue permanently —
    // rejection used to only deactivate the user, so the profile (still
    // isApproved: false) reappeared here on every page load.
    return this.prisma.validatorProfile.findMany({
      where: { isApproved: false, rejectedAt: null },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveValidator(validatorProfileId: string, adminId: string) {
    const updated = await this.prisma.validatorProfile.update({
      where: { id: validatorProfileId },
      data: { isApproved: true, approvedAt: new Date() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.logAdmin(adminId, 'ADMIN_VALIDATOR_APPROVED', {
      type: 'USER',
      id: updated.user.id,
      label: updated.user.name,
    });
    return updated;
  }

  async rejectValidator(validatorProfileId: string, adminId: string) {
    const profile = await this.prisma.validatorProfile.findUnique({
      where: { id: validatorProfileId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!profile) throw new NotFoundException('Validator profile not found');
    await this.prisma.validatorProfile.update({
      where: { id: validatorProfileId },
      data: { rejectedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { isActive: false },
    });
    invalidateUser(profile.userId); // deactivation must bite instantly, not after the auth cache TTL
    await this.logAdmin(adminId, 'ADMIN_VALIDATOR_REJECTED', {
      type: 'USER',
      id: profile.user.id,
      label: profile.user.name,
    });
    return { success: true };
  }

  async getIdeas() {
    return this.prisma.idea.findMany({
      include: {
        founder: { select: { id: true, name: true, email: true } },
        _count: { select: { validations: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteIdea(ideaId: string, adminId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, title: true, founderId: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    await this.prisma.idea.delete({ where: { id: ideaId } });
    await this.logAdmin(adminId, 'ADMIN_IDEA_DELETED', { type: 'IDEA', id: idea.id, label: idea.title });
    return { success: true };
  }

  /**
   * Admin override for the 48-hour dashboard gate on a single idea — used when
   * a founder needs their results early (support request, demo, live pitch).
   * Toggling it off restores the normal timer rather than hiding results that
   * the timer would already have released.
   */
  async toggleIdeaDashboardUnlock(ideaId: string, adminId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, title: true, founderId: true, dashboardUnlockedAt: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');

    const unlocking = idea.dashboardUnlockedAt == null;
    const updated = await this.prisma.idea.update({
      where: { id: ideaId },
      data: { dashboardUnlockedAt: unlocking ? new Date() : null },
      select: { id: true, dashboardUnlockedAt: true },
    });

    await this.logAdmin(
      adminId,
      unlocking ? 'ADMIN_DASHBOARD_UNLOCKED' : 'ADMIN_DASHBOARD_RELOCKED',
      { type: 'IDEA', id: idea.id, label: idea.title },
      { ideaId: idea.id }
    );

    return { dashboardUnlockedAt: updated.dashboardUnlockedAt };
  }

  /**
   * Hard-deletes a user and everything they ever touched. Irreversible by
   * design — this is the "erase all history" action, not a soft deactivate.
   *
   * What goes: their account, validator profile, ideas (which cascades every
   * validation received, score row, payment and attached survey), standalone
   * surveys (cascading questions, sessions, responses, answers, incentives
   * and giveaway entries), validations they authored on other founders'
   * ideas, OTP rows for their phone, and every activity row where they were
   * the actor, the owner, or the target.
   *
   * Guardrails: an admin can never delete themselves, and never another
   * ADMIN account. The deletion itself is logged AFTER it succeeds — the
   * Activity row stores the name as a text snapshot with a soft reference,
   * so the audit line outlives the account it describes.
   */
  async deleteUser(userId: string, adminId: string) {
    if (userId === adminId) throw new ForbiddenException('You cannot delete your own account');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, phone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Admin accounts cannot be deleted');

    await this.prisma.$transaction([
      // Their entire activity history — as actor, as owner of the target, and
      // as the target of admin actions. "Delete all history" means all of it.
      this.prisma.activity.deleteMany({
        where: {
          OR: [
            { userId },
            { ownerUserId: userId },
            { targetType: 'USER', targetId: userId },
          ],
        },
      }),
      // Standalone surveys don't hang off an idea, so they need their own
      // delete; survey children (questions/sessions/responses/answers/
      // incentive/entries) all cascade from Survey.
      this.prisma.survey.deleteMany({ where: { founderId: userId } }),
      // Ideas cascade: self-assessment, every validation received (with all
      // score rows), payments, and any attached surveys.
      this.prisma.idea.deleteMany({ where: { founderId: userId } }),
      // Validations they authored on OTHER founders' ideas — those founders'
      // aggregates recompute automatically since scores are derived live.
      this.prisma.validationResponse.deleteMany({ where: { validatorId: userId } }),
      // Safety net: payments are normally gone via the idea cascade.
      this.prisma.payment.deleteMany({ where: { founderId: userId } }),
      ...(user.phone ? [this.prisma.otpVerification.deleteMany({ where: { phone: user.phone } })] : []),
      // Finally the account itself; ValidatorProfile cascades from User.
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    // A deleted user's JWT must die immediately, not after the auth cache TTL.
    invalidateUser(userId);

    await this.logAdmin(
      adminId,
      'ADMIN_USER_DELETED',
      { type: 'USER', id: user.id, label: user.name },
      { role: user.role, email: user.email }
    );

    return { success: true };
  }

  async toggleUserStatus(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
    invalidateUser(userId); // deactivation must bite instantly, not after the auth cache TTL
    await this.logAdmin(
      adminId,
      updated.isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
      { type: 'USER', id: updated.id, label: updated.name },
      { role: updated.role }
    );
    const { password, ...rest } = updated;
    return rest;
  }

  async getSurveys() {
    return this.prisma.survey.findMany({
      include: {
        founder: { select: { id: true, name: true, email: true } },
        idea: { select: { id: true, title: true } },
        _count: { select: { questions: true, responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Moderation override — live surveys can be pulled offline and closed ones
  // brought back, regardless of which founder owns them.
  async toggleSurveyStatus(surveyId: string, adminId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.status !== 'LIVE' && survey.status !== 'CLOSED') {
      throw new ForbiddenException('Only live or closed surveys can be toggled');
    }
    const updated = await this.prisma.survey.update({
      where: { id: surveyId },
      data: { status: survey.status === 'LIVE' ? 'CLOSED' : 'LIVE' },
    });
    await this.logAdmin(
      adminId,
      'ADMIN_SURVEY_STATUS_CHANGED',
      { type: 'SURVEY', id: updated.id, label: updated.title },
      { from: survey.status, to: updated.status }
    );
    return updated;
  }

  async deleteSurvey(surveyId: string, adminId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found');
    await this.prisma.survey.delete({ where: { id: surveyId } });
    await this.logAdmin(adminId, 'ADMIN_SURVEY_DELETED', { type: 'SURVEY', id: survey.id, label: survey.title });
    return { success: true };
  }

  async getAnalytics() {
    const [
      totalUsers, totalFounders, totalValidators,
      totalIdeas, activeIdeas, totalValidations,
      pendingApprovals, revenueData, totalSurveys, liveSurveys,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'FOUNDER' } }),
      this.prisma.user.count({ where: { role: 'VALIDATOR' } }),
      this.prisma.idea.count(),
      this.prisma.idea.count({ where: { paymentStatus: 'COMPLETED' } }),
      this.prisma.validationResponse.count(),
      this.prisma.validatorProfile.count({ where: { isApproved: false } }),
      this.prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      this.prisma.survey.count(),
      this.prisma.survey.count({ where: { status: 'LIVE' } }),
    ]);

    return {
      totalUsers, totalFounders, totalValidators,
      totalIdeas, activeIdeas, totalValidations,
      pendingApprovals, totalRevenue: revenueData._sum.amount || 0,
      totalSurveys, liveSurveys,
    };
  }

  /**
   * Everything the admin needs to understand one account: their profile, the
   * things they created, and what came back. Password is never selected.
   */
  async getUserOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, phone: true, phoneVerified: true,
        isActive: true, createdAt: true, googleId: true,
        validatorProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [ideas, surveys, validationsGiven] = await Promise.all([
      this.prisma.idea.findMany({
        where: { founderId: userId },
        select: {
          id: true, title: true, industryCategory: true, stage: true, paymentStatus: true,
          version: true, isRevision: true, createdAt: true,
          _count: { select: { validations: true, surveys: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.survey.findMany({
        where: { founderId: userId },
        select: {
          id: true, title: true, status: true, publicId: true, versionNumber: true, createdAt: true,
          idea: { select: { id: true, title: true } },
          _count: { select: { questions: true, responses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Validations this user performed (only meaningful for validators).
      this.prisma.validationResponse.findMany({
        where: { validatorId: userId },
        select: {
          id: true, createdAt: true,
          idea: { select: { id: true, title: true, founder: { select: { id: true, name: true } } } },
          openFeedback: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Validations received on this user's ideas (only meaningful for founders).
    const ideaIds = ideas.map((i) => i.id);
    const validationsReceived = ideaIds.length
      ? await this.prisma.validationResponse.findMany({
          where: { ideaId: { in: ideaIds } },
          select: {
            id: true, createdAt: true,
            validator: { select: { id: true, name: true } },
            idea: { select: { id: true, title: true } },
            openFeedback: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const responsesReceived = surveys.reduce((sum, s) => sum + s._count.responses, 0);

    return {
      user,
      stats: {
        ideas: ideas.length,
        surveys: surveys.length,
        responsesReceived,
        validationsGiven: validationsGiven.length,
        validationsReceived: validationsReceived.length,
      },
      ideas,
      surveys,
      validationsGiven,
      validationsReceived,
    };
  }

  /**
   * Survey header + questions for the admin detail page. The responses
   * themselves are served separately and paginated, so opening a survey with
   * thousands of responses never loads them all.
   */
  async getSurveyDetail(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        founder: { select: { id: true, name: true, email: true } },
        idea: { select: { id: true, title: true } },
        incentive: true,
        questions: {
          include: { options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        _count: { select: { questions: true, responses: true, sessions: true } },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');

    const [firstResponse, lastResponse] = await Promise.all([
      this.prisma.surveyResponse.findFirst({
        where: { surveyId }, orderBy: { submittedAt: 'asc' }, select: { submittedAt: true },
      }),
      this.prisma.surveyResponse.findFirst({
        where: { surveyId }, orderBy: { submittedAt: 'desc' }, select: { submittedAt: true },
      }),
    ]);

    return {
      ...survey,
      questions: survey.questions.map((q) => ({ ...q, settings: JSON.parse(q.settings || '{}') })),
      responseWindow: {
        first: firstResponse?.submittedAt || null,
        last: lastResponse?.submittedAt || null,
      },
    };
  }
}
