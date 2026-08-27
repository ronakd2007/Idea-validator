import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Copies one idea from this machine's database into the live site's database.
 *
 * This is a developer utility, not a product feature. It exists so work done
 * locally — an idea with its expert scores and its AI Deep Dive report — can be
 * seen on the deployed site without redoing it there.
 *
 * It is off unless CLOUD_DATABASE_URL is set, which is what keeps it dormant in
 * production: the deployed server has no such variable, so the endpoint reports
 * itself unavailable and the button never appears.
 *
 * Two rules the copy follows throughout:
 *
 *   People are matched by email, never by id. The same person can have a
 *   different row id on the two databases, so every foreign key is remapped to
 *   whatever id the live database uses.
 *
 *   Everything is an upsert keyed on the local id. Pushing the same idea twice
 *   updates it in place rather than producing a second copy.
 */

/**
 * Every score block hanging off a validation: the relation name on
 * ValidationResponse, and the Prisma delegate that writes it. The two differ
 * for most of them (`marketOpportunity` lives in `MarketOpportunityScore`), so
 * both are spelled out rather than derived.
 */
const SCORE_RELATIONS: { relation: string; delegate: string }[] = [
  { relation: 'marketOpportunity', delegate: 'marketOpportunityScore' },
  { relation: 'feasibility', delegate: 'feasibilityScore' },
  { relation: 'founderFit', delegate: 'founderFitScore' },
  { relation: 'revenuePotential', delegate: 'revenuePotentialScore' },
  { relation: 'scalability', delegate: 'scalabilityScore' },
  { relation: 'riskAssessment', delegate: 'riskAssessment' },
  { relation: 'investorAttractiveness', delegate: 'investorAttractivenessScore' },
  { relation: 'innovation', delegate: 'innovationScore' },
  { relation: 'socialImpact', delegate: 'socialImpactScore' },
  { relation: 'customerValidation', delegate: 'customerValidation' },
  { relation: 'sharkTank', delegate: 'sharkTankScore' },
  { relation: 'startupSuccess', delegate: 'startupSuccessScore' },
  { relation: 'openFeedback', delegate: 'openFeedback' },
];

export interface PushSummary {
  idea: string;
  validations: number;
  aiRuns: number;
  surveys: number;
  createdFounder: boolean;
  createdValidators: number;
  target: string;
}

@Injectable()
export class CloudPushService {
  private readonly logger = new Logger(CloudPushService.name);

  constructor(private prisma: PrismaService) {}

  static isConfigured(): boolean {
    return !!process.env.CLOUD_DATABASE_URL;
  }

  /** Host only, so the UI can say where a push is going without exposing credentials. */
  static targetLabel(): string {
    const url = process.env.CLOUD_DATABASE_URL;
    if (!url) return '';
    try {
      return new URL(url).host;
    } catch {
      return 'the configured database';
    }
  }

  async pushIdea(ideaId: string, founderId: string): Promise<PushSummary> {
    if (!CloudPushService.isConfigured()) {
      throw new ServiceUnavailableException('Push to cloud is not configured — CLOUD_DATABASE_URL is not set on this server.');
    }

    const idea: any = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        founder: true,
        selfAssessment: true,
        aiValidationRuns: true,
        validations: { include: Object.fromEntries(SCORE_RELATIONS.map(r => [r.relation, true])) as any },
        surveys: { include: { questions: true } },
      },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');

    // Validator identities are needed to reattach their scores, and they are
    // loaded separately so the validation query stays free of user records.
    const validatorIds = [...new Set(idea.validations.map((v: any) => v.validatorId))];
    const validators = validatorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: validatorIds as string[] } } })
      : [];

    const cloud = new PrismaClient({ datasources: { db: { url: process.env.CLOUD_DATABASE_URL } } });

    try {
      await cloud.$connect();

      const { id: cloudFounderId, created: createdFounder } = await this.upsertPerson(cloud, idea.founder);

      const validatorMap = new Map<string, string>();
      let createdValidators = 0;
      for (const validator of validators) {
        const { id, created } = await this.upsertPerson(cloud, validator);
        validatorMap.set(validator.id, id);
        if (created) createdValidators++;
      }

      await this.upsertIdea(cloud, idea, cloudFounderId);
      if (idea.selfAssessment) await this.upsertSelfAssessment(cloud, idea.selfAssessment);

      for (const validation of idea.validations) {
        const cloudValidatorId = validatorMap.get(validation.validatorId);
        if (!cloudValidatorId) continue;
        await this.upsertValidation(cloud, validation, cloudValidatorId);
      }

      for (const run of idea.aiValidationRuns) await this.upsertAiRun(cloud, run);

      const surveys = await this.upsertSurveys(cloud, idea.surveys, cloudFounderId);

      return {
        idea: idea.title,
        validations: idea.validations.length,
        aiRuns: idea.aiValidationRuns.length,
        surveys,
        createdFounder,
        createdValidators,
        target: CloudPushService.targetLabel(),
      };
    } catch (err: any) {
      this.logger.error(`Push to cloud failed for idea ${ideaId}: ${err?.message}`);
      throw new BadRequestException(this.describe(err));
    } finally {
      await cloud.$disconnect().catch(() => undefined);
    }
  }

  // ---------- writers ----------

  /**
   * Finds this person on the live database by email, or creates them.
   *
   * Email is the identity that survives the trip; ids do not. An existing
   * account is never overwritten — the live password, role and profile belong
   * to that database, and clobbering them could lock a real person out.
   */
  private async upsertPerson(cloud: PrismaClient, user: any): Promise<{ id: string; created: boolean }> {
    const existing = await cloud.user.findUnique({ where: { email: user.email }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };

    const created = await cloud.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        googleId: user.googleId,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        isActive: user.isActive,
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  }

  private async upsertIdea(cloud: PrismaClient, idea: any, cloudFounderId: string) {
    const fields = {
      title: idea.title,
      videoUrl: idea.videoUrl,
      teamMembers: idea.teamMembers,
      assumptions: idea.assumptions,
      industryCategory: idea.industryCategory,
      problemStatement: idea.problemStatement,
      solutionDescription: idea.solutionDescription,
      targetCustomer: idea.targetCustomer,
      revenueModel: idea.revenueModel,
      stage: idea.stage,
      founderContext: idea.founderContext,
      isRevision: idea.isRevision,
      revisionOf: idea.revisionOf,
      version: idea.version,
      paymentStatus: idea.paymentStatus,
      submittedAt: idea.submittedAt,
      aiSummary: idea.aiSummary,
      aiSummaryAt: idea.aiSummaryAt,
      // publicId is deliberately not copied: it is a unique share token, and
      // carrying it over could collide with a link the live site already issued.
    };

    await cloud.idea.upsert({
      where: { id: idea.id },
      create: { id: idea.id, founderId: cloudFounderId, ...fields },
      update: { founderId: cloudFounderId, ...fields },
    });
  }

  private async upsertSelfAssessment(cloud: PrismaClient, assessment: any) {
    const { id, ideaId, ...fields } = assessment;
    await cloud.founderFitSelfAssessment.upsert({
      where: { ideaId },
      create: { id, ideaId, ...fields },
      update: fields,
    });
  }

  private async upsertValidation(cloud: PrismaClient, validation: any, cloudValidatorId: string) {
    const base = {
      ideaId: validation.ideaId,
      validatorId: cloudValidatorId,
      createdAt: validation.createdAt,
      helpfulRating: validation.helpfulRating,
      ratedAt: validation.ratedAt,
    };

    await cloud.validationResponse.upsert({
      where: { id: validation.id },
      create: { id: validation.id, ...base },
      update: base,
    });

    // Each score block is its own table keyed by the validation, so they are
    // written one at a time against the same parent id.
    for (const { relation, delegate } of SCORE_RELATIONS) {
      const score = validation[relation];
      if (!score) continue;
      const { id, validationResponseId, ...fields } = score;
      await (cloud as any)[delegate].upsert({
        where: { validationResponseId: validation.id },
        create: { id, validationResponseId: validation.id, ...fields },
        update: fields,
      });
    }
  }

  private async upsertAiRun(cloud: PrismaClient, run: any) {
    const { id, ...fields } = run;
    await cloud.aiValidationRun.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
  }

  /**
   * Surveys travel with their questions so the idea's survey tab is not empty,
   * but responses stay behind: they are other people's answers collected under
   * this machine's copy of the survey, and duplicating them into the live site
   * would inflate real response counts.
   */
  private async upsertSurveys(cloud: PrismaClient, surveys: any[], cloudFounderId: string): Promise<number> {
    let copied = 0;
    for (const survey of surveys) {
      const { questions, founderId, publicId, ...fields } = survey;
      const surveyFields = { ...fields, founderId: cloudFounderId, publicId: null as any };

      await cloud.survey.upsert({
        where: { id: survey.id },
        create: surveyFields as any,
        update: { ...surveyFields, id: undefined } as any,
      });

      for (const question of questions || []) {
        const { id, ...qFields } = question;
        await cloud.surveyQuestion.upsert({
          where: { id },
          create: { id, ...qFields },
          update: qFields,
        });
      }
      copied++;
    }
    return copied;
  }

  private describe(err: any): string {
    const message = String(err?.message || '');
    if (/ENOTFOUND|ECONNREFUSED|timeout|Can't reach database/i.test(message)) {
      return 'Could not reach the live database — check CLOUD_DATABASE_URL and that the database allows connections from this machine.';
    }
    if (/authentication|password/i.test(message)) {
      return 'The live database rejected the credentials in CLOUD_DATABASE_URL.';
    }
    if (/does not exist|relation .* does not exist/i.test(message)) {
      return 'The live database is missing a table this copy needs — deploy the current code there first so its schema is up to date.';
    }
    return `Push to cloud failed: ${message.slice(0, 300)}`;
  }
}
