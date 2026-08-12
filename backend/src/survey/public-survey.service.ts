import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class PublicSurveyService {
  constructor(private prisma: PrismaService, private activity: ActivityService) {}

  /**
   * Respondent activity is recorded with NO userId and NO session token — a
   * respondent has no account by design, and nothing here can be joined back to
   * an individual person or to their answers. ownerUserId points at the founder
   * so the event also shows on their profile as activity on their survey.
   */
  private logRespondent(
    action: string,
    survey: { id: string; title: string; founderId: string },
    metadata: Record<string, any> = {}
  ) {
    void this.activity.log({
      userId: null,
      actorRole: 'RESPONDENT',
      actorLabel: 'Anonymous respondent',
      action,
      targetType: 'SURVEY',
      targetId: survey.id,
      targetLabel: survey.title,
      ownerUserId: survey.founderId,
      metadata: { surveyId: survey.id, ...metadata },
    });
  }

  private async loadByPublicId(publicId: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { publicId },
      include: {
        questions: { include: { options: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
        incentive: true,
        _count: { select: { responses: true } },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    return survey;
  }

  // Deterministic per-session A/B assignment — no extra table needed, and it's
  // stable across refreshes since the session token itself is stable.
  private pickVariant(sessionToken: string, groupKey: string): 'A' | 'B' {
    const hash = createHash('md5').update(`${sessionToken}:${groupKey}`).digest();
    return hash[0] % 2 === 0 ? 'A' : 'B';
  }

  // Respondents only ever see one variant per A/B group. isControlQuestion/
  // consistencyPairQuestionId/abGroupKey/abVariant are analytics-only — never
  // surfaced as labels to the respondent, only used to pick which question shows.
  private visibleQuestions(questions: any[], sessionToken?: string) {
    const abGroups = new Map<string, any[]>();
    const plain: any[] = [];
    questions.forEach((q) => {
      if (q.abGroupKey) {
        if (!abGroups.has(q.abGroupKey)) abGroups.set(q.abGroupKey, []);
        abGroups.get(q.abGroupKey)!.push(q);
      } else {
        plain.push(q);
      }
    });

    const chosen: any[] = [...plain];
    abGroups.forEach((qs, key) => {
      if (qs.length < 2) { chosen.push(qs[0]); return; }
      const variant = sessionToken ? this.pickVariant(sessionToken, key) : 'A';
      chosen.push(qs.find((q) => q.abVariant === variant) || qs[0]);
    });

    return chosen.sort((a, b) => a.order - b.order);
  }

  // Public-safe shape only — no founderId/ideaId/internal survey id leaves this method.
  async getPublic(publicId: string, sessionToken?: string) {
    const survey = await this.loadByPublicId(publicId);
    const limitReached = survey.responseLimit != null && survey._count.responses >= survey.responseLimit;

    return {
      title: survey.title,
      description: survey.description,
      status: survey.status,
      collectEmail: survey.collectEmail,
      limitReached,
      incentive: survey.incentive
        ? {
            title: survey.incentive.title,
            description: survey.incentive.description,
            numberOfWinners: survey.incentive.numberOfWinners,
            eligibility: survey.incentive.eligibility,
            closingDate: survey.incentive.closingDate,
            collectContact: survey.incentive.collectContact,
          }
        : null,
      questions: this.visibleQuestions(survey.questions, sessionToken).map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        description: q.description,
        required: q.required,
        mediaUrl: q.mediaUrl,
        mediaType: q.mediaType,
        options: q.options.map((o: any) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })),
        settings: JSON.parse(q.settings || '{}'),
      })),
    };
  }

  async startSession(publicId: string) {
    const survey = await this.loadByPublicId(publicId);
    if (survey.status !== 'LIVE') throw new BadRequestException('This survey is not currently accepting responses');
    if (survey.responseLimit != null && survey._count.responses >= survey.responseLimit) {
      throw new BadRequestException('This survey has reached its response limit');
    }

    const token = randomBytes(16).toString('base64url');
    const session = await this.prisma.surveySession.create({ data: { surveyId: survey.id, token } });
    this.logRespondent('SURVEY_OPENED', survey);
    return { sessionToken: session.token };
  }

  // Best-effort progress signal for Phase 3 drop-off analysis — fire-and-forget
  // from the client, never blocks or errors the respondent's experience.
  async updateProgress(publicId: string, sessionToken: string, questionIndex: number) {
    const survey = await this.prisma.survey.findUnique({
      where: { publicId },
      select: { id: true, title: true, founderId: true },
    });
    if (!survey || !sessionToken) return { success: false };
    const session = await this.prisma.surveySession.findUnique({ where: { token: sessionToken } });
    if (!session || session.surveyId !== survey.id || session.completed) return { success: false };
    if (questionIndex <= session.lastQuestionIndex) return { success: true };

    // Moving past the first question is what distinguishes "started" from
    // merely opening the link. Fires at most once per session.
    if (session.lastQuestionIndex === 0 && questionIndex > 0) {
      this.logRespondent('SURVEY_STARTED', survey);
    }

    await this.prisma.surveySession.update({
      where: { id: session.id },
      data: { lastQuestionIndex: questionIndex, lastActivityAt: new Date() },
    });
    return { success: true };
  }

  private validateAnswers(questions: any[], rawAnswers: { questionId: string; value: any }[]) {
    const errors: { questionId: string; message: string }[] = [];
    const answerMap = new Map(rawAnswers.map((a) => [a.questionId, a.value]));

    for (const q of questions) {
      const val = answerMap.get(q.id);
      const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);

      if (q.required && isEmpty) {
        errors.push({ questionId: q.id, message: 'This question is required.' });
        continue;
      }
      if (isEmpty) continue;

      const settings = JSON.parse(q.settings || '{}');
      const validOptionIds = (q.options || []).map((o: any) => o.id);

      switch (q.type) {
        case 'MULTIPLE_CHOICE':
        case 'IMAGE_CHOICE':
        case 'DROPDOWN':
          if (typeof val !== 'string' || !validOptionIds.includes(val)) {
            errors.push({ questionId: q.id, message: 'Invalid selection.' });
          }
          break;
        case 'CHECKBOXES':
          if (!Array.isArray(val) || !val.every((v: any) => validOptionIds.includes(v))) {
            errors.push({ questionId: q.id, message: 'Invalid selection.' });
          }
          break;
        case 'YES_NO':
          if (val !== 'Yes' && val !== 'No') errors.push({ questionId: q.id, message: 'Invalid answer.' });
          break;
        case 'RATING': {
          const max = settings.max || 5;
          if (typeof val !== 'number' || val < 1 || val > max) {
            errors.push({ questionId: q.id, message: `Must be between 1 and ${max}.` });
          }
          break;
        }
        case 'LINEAR_SCALE': {
          const min = settings.min ?? 1;
          const max = settings.max ?? 10;
          if (typeof val !== 'number' || val < min || val > max) {
            errors.push({ questionId: q.id, message: `Must be between ${min} and ${max}.` });
          }
          break;
        }
        case 'SHORT_ANSWER':
        case 'PARAGRAPH':
          if (typeof val !== 'string') errors.push({ questionId: q.id, message: 'Invalid answer.' });
          break;
      }
    }
    return errors;
  }

  async submit(
    publicId: string,
    sessionToken: string,
    rawAnswers: { questionId: string; value: any }[],
    respondentEmail?: string
  ) {
    const survey = await this.loadByPublicId(publicId);
    if (survey.status !== 'LIVE') throw new BadRequestException('This survey is no longer accepting responses');
    if (survey.responseLimit != null && survey._count.responses >= survey.responseLimit) {
      throw new BadRequestException('This survey has reached its response limit');
    }

    if (!sessionToken) throw new BadRequestException('Missing session');
    const session = await this.prisma.surveySession.findUnique({ where: { token: sessionToken } });
    if (!session || session.surveyId !== survey.id) throw new BadRequestException('Invalid or expired session');
    if (session.completed) throw new ConflictException('This session has already submitted a response');

    // Validate only against the question set this session actually saw — the
    // unseen A/B variant must never block submission even if marked required.
    const seenQuestions = this.visibleQuestions(survey.questions, sessionToken);
    const errors = this.validateAnswers(seenQuestions, rawAnswers || []);
    if (errors.length) throw new BadRequestException({ message: 'Validation failed', errors });

    await this.prisma.$transaction(async (tx) => {
      const response = await tx.surveyResponse.create({
        data: {
          surveyId: survey.id,
          sessionId: session.id,
          respondentEmail: survey.collectEmail && respondentEmail ? respondentEmail : null,
        },
      });

      const seenIds = new Set(seenQuestions.map((q) => q.id));
      for (const a of rawAnswers || []) {
        if (!seenIds.has(a.questionId)) continue; // never persist an answer for a question this session didn't see
        const isEmpty = a.value === undefined || a.value === null || a.value === '' || (Array.isArray(a.value) && a.value.length === 0);
        if (isEmpty) continue;
        await tx.surveyAnswer.create({
          data: { responseId: response.id, questionId: a.questionId, value: JSON.stringify(a.value) },
        });
      }

      await tx.surveySession.update({
        where: { id: session.id },
        data: { completed: true, submittedAt: new Date(), lastActivityAt: new Date() },
      });
    });

    // Logged after the transaction commits, so the feed can never show a
    // submission that didn't actually persist. Records the count only — never
    // the answers, the email, or anything identifying the respondent.
    this.logRespondent('SURVEY_SUBMITTED', survey, { answerCount: (rawAnswers || []).length });

    return { success: true };
  }

  // Deliberately takes no sessionToken and writes to a model with zero relation
  // to SurveyResponse/SurveySession — this is what keeps a giveaway entry from
  // ever being joinable back to a specific anonymous respondent's answers.
  async submitIncentiveEntry(publicId: string, name: string, contact: string) {
    const survey = await this.prisma.survey.findUnique({ where: { publicId }, include: { incentive: true } });
    if (!survey) throw new NotFoundException('Survey not found');
    if (!survey.incentive) throw new BadRequestException('This survey has no incentive configured');
    if (!survey.incentive.collectContact) throw new BadRequestException('This incentive does not collect contact information');
    if (!name?.trim() || !contact?.trim()) throw new BadRequestException('Name and contact information are required');

    await this.prisma.incentiveEntry.create({
      data: { incentiveId: survey.incentive.id, name: name.trim(), contact: contact.trim() },
    });
    return { success: true };
  }
}
