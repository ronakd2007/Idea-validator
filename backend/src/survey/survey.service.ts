import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { sanitizeDescription } from './rich-text.util';
import { parseReportShareSettings, sanitizeReportShareSettings } from './survey-share.util';

const CHOICE_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'IMAGE_CHOICE'];

@Injectable()
export class SurveyService {
  constructor(private prisma: PrismaService, private activity: ActivityService) {}

  private async logSurvey(
    action: string,
    survey: { id: string; title: string; status?: string },
    founderId: string,
    metadata: Record<string, any> = {}
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: founderId }, select: { name: true, role: true } });
    void this.activity.log({
      userId: founderId,
      actorRole: user?.role || 'FOUNDER',
      actorLabel: user?.name || 'Unknown user',
      action,
      targetType: 'SURVEY',
      targetId: survey.id,
      targetLabel: survey.title,
      ownerUserId: founderId,
      metadata: { surveyId: survey.id, ...(survey.status ? { status: survey.status } : {}), ...metadata },
    });
  }

  private include = {
    idea: { select: { id: true, title: true } },
    questions: {
      include: { options: { orderBy: { order: 'asc' as const } } },
      orderBy: { order: 'asc' as const },
    },
    incentive: true,
  };

  // ideaId is optional — a survey can be created and run entirely on its own,
  // with no Idea submission required. It can still be attached to one when provided.
  async create(founderId: string, ideaId: string | undefined, title: string, description: string) {
    if (ideaId) {
      const idea = await this.prisma.idea.findUnique({ where: { id: ideaId } });
      if (!idea) throw new NotFoundException('Idea not found');
      if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');
    }

    const survey = await this.prisma.survey.create({
      data: { ideaId: ideaId || null, founderId, title: title?.trim() || 'Untitled Survey', description: sanitizeDescription(description) },
      include: this.include,
    });

    await this.logSurvey('SURVEY_CREATED', survey, founderId, { ideaId: survey.ideaId });
    return survey;
  }

  async findMine(founderId: string) {
    return this.prisma.survey.findMany({
      where: { founderId },
      include: {
        idea: { select: { id: true, title: true } },
        _count: { select: { questions: true, responses: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async findOwned(id: string, founderId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id }, include: this.include });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.founderId !== founderId) throw new ForbiddenException('Access denied');
    return survey;
  }

  async findOne(id: string, founderId: string) {
    return this.findOwned(id, founderId);
  }

  async update(id: string, founderId: string, data: any) {
    const existing = await this.findOwned(id, founderId);

    const { title, description, questions, responseLimit, collectEmail } = data;

    // Live/closed surveys: questions are locked to protect existing responses
    // (that's what Edit (New Version) is for), but display details that can't
    // affect answers — title, description, response limit — stay editable.
    // collectEmail stays locked too: flipping it mid-collection would mix
    // identified and anonymous responses in one dataset.
    if (existing.status !== 'DRAFT') {
      if (questions !== undefined || collectEmail !== undefined) {
        throw new ForbiddenException('Questions can only be edited on a draft — use Edit (New Version) to change them.');
      }
      await this.prisma.survey.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description: sanitizeDescription(description) } : {}),
          ...(responseLimit !== undefined ? { responseLimit: responseLimit === null || responseLimit === '' ? null : Number(responseLimit) } : {}),
        },
      });
      const updated = await this.findOwned(id, founderId);
      await this.logSurvey('SURVEY_UPDATED', updated, founderId, { detailsOnly: true });
      return updated;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.survey.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description: sanitizeDescription(description) } : {}),
          ...(responseLimit !== undefined ? { responseLimit: responseLimit === null || responseLimit === '' ? null : Number(responseLimit) } : {}),
          ...(collectEmail !== undefined ? { collectEmail: !!collectEmail } : {}),
        },
      });

      // Draft-only builder, no responses reference question ids yet — a full
      // replace keeps "Save Draft" atomic and avoids a much more complex diff.
      await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });

      const incoming = questions || [];
      // consistencyPairQuestionId arrives as an id from the *client's* current
      // state, which goes stale the instant we recreate rows below — resolve
      // pairings by array position instead, then patch the reference in afterward.
      const idToIndex = new Map<string, number>();
      incoming.forEach((q: any, i: number) => { if (q.id) idToIndex.set(q.id, i); });

      const createdIds: string[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const q = incoming[i];
        const created = await tx.surveyQuestion.create({
          data: {
            surveyId: id,
            type: q.type,
            questionText: q.questionText || '',
            description: q.description || '',
            required: !!q.required,
            order: i,
            settings: JSON.stringify(q.settings || {}),
            isControlQuestion: !!q.isControlQuestion,
            abGroupKey: q.abGroupKey || null,
            abVariant: q.abVariant || null,
            mediaUrl: q.mediaUrl || null,
            mediaType: q.mediaUrl ? q.mediaType || null : null,
          },
        });
        // Options go in one batched round trip per question instead of a
        // nested create. Measured on a 14-question / 71-option survey: 69
        // queries -> 53. A modest win locally, but every removed round trip
        // is latency that counts against the transaction budget on a remote
        // database.
        const opts = (q.options || []).map((opt: any, oi: number) => ({
          questionId: created.id,
          label: opt.label || '',
          order: oi,
          imageUrl: opt.imageUrl || null,
        }));
        if (opts.length) await tx.surveyQuestionOption.createMany({ data: opts });
        createdIds.push(created.id);
      }

      for (let i = 0; i < incoming.length; i++) {
        const pairId = incoming[i].consistencyPairQuestionId;
        if (!pairId || !idToIndex.has(pairId)) continue;
        const targetIndex = idToIndex.get(pairId)!;
        await tx.surveyQuestion.update({
          where: { id: createdIds[i] },
          data: { consistencyPairQuestionId: createdIds[targetIndex] },
        });
      }
    // Prisma's default interactive-transaction timeout is 5s, which a large
    // survey (a 14-question AI draft, say) can exceed on a remote database —
    // surfacing as a bare 500. The work here is bounded and idempotent, so a
    // generous ceiling is safer than a failed save.
    }, { timeout: 30_000, maxWait: 10_000 });

    const updated = await this.findOwned(id, founderId);
    await this.logSurvey('SURVEY_UPDATED', updated, founderId, { questionCount: updated.questions.length });
    return updated;
  }

  async remove(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    if (survey.status !== 'DRAFT') throw new ForbiddenException('Only draft surveys can be deleted');
    await this.prisma.survey.delete({ where: { id } });
    // targetId/targetLabel are soft references, so the record of the deletion
    // survives the row it points at.
    await this.logSurvey('SURVEY_DELETED', survey, founderId);
    return { success: true };
  }

  private validateForPublish(survey: any): string[] {
    const errors: string[] = [];
    if (!survey.title || !survey.title.trim()) errors.push('Your survey needs a title before it can be published.');
    if (!survey.questions || survey.questions.length === 0) {
      errors.push('Your survey needs at least one question before it can be published.');
      return errors;
    }
    survey.questions.forEach((q: any, i: number) => {
      const label = `Question ${i + 1}`;
      if (!q.questionText || !q.questionText.trim()) errors.push(`${label} is missing question text.`);
      if (CHOICE_TYPES.includes(q.type)) {
        const validOptions = (q.options || []).filter((o: any) => o.label && o.label.trim());
        if (validOptions.length < 1) errors.push(`${label} needs at least one option.`);
      }
      if (q.type === 'LINEAR_SCALE') {
        const s = JSON.parse(q.settings || '{}');
        if (typeof s.min !== 'number' || typeof s.max !== 'number' || s.min >= s.max) {
          errors.push(`${label} has an invalid scale configuration.`);
        }
      }
    });
    return errors;
  }

  // ---------- public results link ----------

  // 18 bytes (vs 9 for the collection link) — this token guards aggregate
  // results, so it is worth making brute-force enumeration hopeless.
  private async uniqueShareId(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const id = randomBytes(18).toString('base64url');
      const exists = await this.prisma.survey.findFirst({ where: { shareId: id }, select: { id: true } });
      if (!exists) return id;
    }
    throw new Error('Could not generate a unique share id');
  }

  private shareState(survey: { shareId: string | null; shareEnabled: boolean; shareSettings: string }) {
    return {
      shareId: survey.shareId,
      shareEnabled: survey.shareEnabled,
      shareSettings: parseReportShareSettings(survey.shareSettings),
    };
  }

  async getShare(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    return this.shareState(survey);
  }

  async enableShare(id: string, founderId: string, settings?: any) {
    const survey = await this.findOwned(id, founderId);
    const shareId = survey.shareId || (await this.uniqueShareId());
    const merged = { ...parseReportShareSettings(survey.shareSettings), ...sanitizeReportShareSettings(settings) };
    const updated = await this.prisma.survey.update({
      where: { id },
      data: { shareId, shareEnabled: true, shareSettings: JSON.stringify(merged) },
      select: { shareId: true, shareEnabled: true, shareSettings: true },
    });
    await this.logSurvey('SURVEY_REPORT_SHARED', survey, founderId);
    return this.shareState(updated);
  }

  async updateShareSettings(id: string, founderId: string, settings: any) {
    const survey = await this.findOwned(id, founderId);
    const merged = { ...parseReportShareSettings(survey.shareSettings), ...sanitizeReportShareSettings(settings) };
    const updated = await this.prisma.survey.update({
      where: { id },
      data: { shareSettings: JSON.stringify(merged) },
      select: { shareId: true, shareEnabled: true, shareSettings: true },
    });
    return this.shareState(updated);
  }

  // Disabling keeps the shareId, so re-enabling restores the same link.
  async disableShare(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    await this.prisma.survey.update({ where: { id }, data: { shareEnabled: false } });
    await this.logSurvey('SURVEY_REPORT_UNSHARED', survey, founderId);
    return { success: true };
  }

  private generatePublicId() {
    return randomBytes(9).toString('base64url');
  }

  private async uniquePublicId(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const id = this.generatePublicId();
      const exists = await this.prisma.survey.findUnique({ where: { publicId: id } });
      if (!exists) return id;
    }
    throw new Error('Could not generate a unique public survey id');
  }

  async publish(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    if (survey.status !== 'DRAFT') throw new ForbiddenException('Only draft surveys can be published');

    const errors = this.validateForPublish(survey);
    if (errors.length) throw new BadRequestException(errors.join(' '));

    const publicId = survey.publicId || (await this.uniquePublicId());
    await this.prisma.survey.update({ where: { id }, data: { status: 'LIVE', publicId } });

    const published = await this.findOwned(id, founderId);
    await this.logSurvey('SURVEY_PUBLISHED', published, founderId, { questionCount: published.questions.length });
    return published;
  }

  async close(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    if (survey.status !== 'LIVE') throw new ForbiddenException('Only live surveys can be closed');
    await this.prisma.survey.update({ where: { id }, data: { status: 'CLOSED' } });

    const closed = await this.findOwned(id, founderId);
    await this.logSurvey('SURVEY_CLOSED', closed, founderId);
    return closed;
  }

  async reopen(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    if (survey.status !== 'CLOSED') throw new ForbiddenException('Only closed surveys can be reopened');
    await this.prisma.survey.update({ where: { id }, data: { status: 'LIVE' } });

    const reopened = await this.findOwned(id, founderId);
    await this.logSurvey('SURVEY_REOPENED', reopened, founderId);
    return reopened;
  }

  // A LIVE/CLOSED survey's questions are locked (see update() above) to protect
  // existing responses. To change one, clone it into a brand-new DRAFT row —
  // the original row, and every response pointing at it, is never touched.
  async createVersion(id: string, founderId: string) {
    const source = await this.findOwned(id, founderId);
    const rootId = source.rootSurveyId || source.id;

    const siblings = await this.prisma.survey.findMany({
      where: { OR: [{ id: rootId }, { rootSurveyId: rootId }] },
      select: { versionNumber: true },
    });
    const nextVersion = Math.max(1, ...siblings.map((s) => s.versionNumber)) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const newSurvey = await tx.survey.create({
        data: {
          ideaId: source.ideaId,
          founderId,
          title: source.title,
          description: source.description,
          responseLimit: source.responseLimit,
          collectEmail: source.collectEmail,
          rootSurveyId: rootId,
          versionNumber: nextVersion,
        },
      });

      for (let i = 0; i < source.questions.length; i++) {
        const q = source.questions[i];
        const newQuestion = await tx.surveyQuestion.create({
          data: {
            surveyId: newSurvey.id,
            type: q.type,
            questionText: q.questionText,
            description: q.description,
            required: q.required,
            order: i,
            settings: q.settings,
            isControlQuestion: q.isControlQuestion,
            abGroupKey: q.abGroupKey,
            abVariant: q.abVariant,
            mediaUrl: q.mediaUrl,
            mediaType: q.mediaType,
          },
        });
        // One round trip for the whole option list, as in update() above.
        const opts = q.options.map((opt: any, oi: number) => ({
          questionId: newQuestion.id,
          label: opt.label,
          order: oi,
          imageUrl: opt.imageUrl,
        }));
        if (opts.length) await tx.surveyQuestionOption.createMany({ data: opts });
        // consistencyPairQuestionId intentionally not carried over — the paired
        // question's new id isn't known until this loop finishes; not worth the
        // extra resolution pass for a rarely-used analytics-only setting on a clone.
      }

      if (source.incentive) {
        await tx.surveyIncentive.create({
          data: {
            surveyId: newSurvey.id,
            title: source.incentive.title,
            description: source.incentive.description,
            numberOfWinners: source.incentive.numberOfWinners,
            eligibility: source.incentive.eligibility,
            closingDate: source.incentive.closingDate,
            collectContact: source.incentive.collectContact,
          },
        });
      }

      return newSurvey;
      // Same reasoning as update(): cloning a large survey can outrun the 5s
      // default on a remote database.
    }, { timeout: 30_000, maxWait: 10_000 });

    const version = await this.findOwned(created.id, founderId);
    await this.logSurvey('SURVEY_CREATED', version, founderId, {
      versionNumber: version.versionNumber,
      versionOf: id,
    });
    return version;
  }

  async getVersions(id: string, founderId: string) {
    const survey = await this.findOwned(id, founderId);
    const rootId = survey.rootSurveyId || survey.id;
    return this.prisma.survey.findMany({
      where: { OR: [{ id: rootId }, { rootSurveyId: rootId }] },
      select: { id: true, versionNumber: true, status: true, createdAt: true, publicId: true, _count: { select: { responses: true } } },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async upsertIncentive(id: string, founderId: string, data: any) {
    await this.findOwned(id, founderId);
    const payload = {
      title: data.title || '',
      description: data.description || '',
      numberOfWinners: Math.max(1, Number(data.numberOfWinners) || 1),
      eligibility: data.eligibility || '',
      closingDate: data.closingDate ? new Date(data.closingDate) : null,
      collectContact: data.collectContact !== false,
    };
    await this.prisma.surveyIncentive.upsert({
      where: { surveyId: id },
      create: { surveyId: id, ...payload },
      update: payload,
    });
    return this.findOwned(id, founderId);
  }

  async removeIncentive(id: string, founderId: string) {
    await this.findOwned(id, founderId);
    await this.prisma.surveyIncentive.deleteMany({ where: { surveyId: id } });
    return this.findOwned(id, founderId);
  }
}
