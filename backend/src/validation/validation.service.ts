import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ValidationService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.validationResponse.create({
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
    return { alreadyValidated: !!existing };
  }
}
