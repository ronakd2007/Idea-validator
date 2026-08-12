import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsers(role?: string) {
    const users = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      include: { validatorProfile: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ password, ...u }) => u);
  }

  async getPendingValidators() {
    return this.prisma.validatorProfile.findMany({
      where: { isApproved: false },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveValidator(validatorProfileId: string) {
    return this.prisma.validatorProfile.update({
      where: { id: validatorProfileId },
      data: { isApproved: true, approvedAt: new Date() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async rejectValidator(validatorProfileId: string) {
    const profile = await this.prisma.validatorProfile.findUnique({
      where: { id: validatorProfileId },
    });
    if (!profile) throw new NotFoundException('Validator profile not found');
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { isActive: false },
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

  async deleteIdea(ideaId: string) {
    await this.prisma.idea.delete({ where: { id: ideaId } });
    return { success: true };
  }

  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
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
  async toggleSurveyStatus(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.status !== 'LIVE' && survey.status !== 'CLOSED') {
      throw new ForbiddenException('Only live or closed surveys can be toggled');
    }
    return this.prisma.survey.update({
      where: { id: surveyId },
      data: { status: survey.status === 'LIVE' ? 'CLOSED' : 'LIVE' },
    });
  }

  async deleteSurvey(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found');
    await this.prisma.survey.delete({ where: { id: surveyId } });
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
}
