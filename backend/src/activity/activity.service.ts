import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isViewAsRequest } from '../auth/view-as.context';

/**
 * The complete set of actions this platform records. If an action is not in
 * this catalog it is not logged — there is deliberately no generic "log any
 * request" path, no page-view tracking, and no request interceptor.
 *
 * Each entry carries its own category and display label so the feed, the user
 * profile and the detail panel all render an action the same way.
 */
export const ACTION_CATALOG: Record<string, { category: string; label: string }> = {
  // Account
  ACCOUNT_SIGNUP: { category: 'ACCOUNT', label: 'Signed up' },
  ACCOUNT_LOGIN: { category: 'ACCOUNT', label: 'Logged in' },

  // Ideas
  IDEA_CREATED: { category: 'IDEAS', label: 'Created idea' },
  IDEA_REVISED: { category: 'IDEAS', label: 'Revised idea' },
  IDEA_SUBMITTED: { category: 'IDEAS', label: 'Submitted idea' },
  IDEA_RESULTS_VIEWED: { category: 'IDEAS', label: 'Viewed validation results' },
  IDEA_DELETED: { category: 'IDEAS', label: 'Deleted idea' },

  // Surveys (founder side)
  SURVEY_CREATED: { category: 'SURVEYS', label: 'Created survey' },
  SURVEY_UPDATED: { category: 'SURVEYS', label: 'Updated survey' },
  SURVEY_PUBLISHED: { category: 'SURVEYS', label: 'Published survey' },
  SURVEY_CLOSED: { category: 'SURVEYS', label: 'Closed survey' },
  SURVEY_REOPENED: { category: 'SURVEYS', label: 'Reopened survey' },
  SURVEY_DELETED: { category: 'SURVEYS', label: 'Deleted survey' },
  SURVEY_REPORT_SHARED: { category: 'SURVEYS', label: 'Shared survey results publicly' },
  SURVEY_REPORT_UNSHARED: { category: 'SURVEYS', label: 'Stopped sharing survey results' },

  // Surveys (respondent side — always anonymous, never tied to an account)
  SURVEY_OPENED: { category: 'RESPONSES', label: 'Opened survey' },
  SURVEY_STARTED: { category: 'RESPONSES', label: 'Started survey' },
  SURVEY_SUBMITTED: { category: 'RESPONSES', label: 'Submitted survey response' },

  // Validations
  VALIDATION_OPENED: { category: 'VALIDATIONS', label: 'Opened validation request' },
  VALIDATION_SUBMITTED: { category: 'VALIDATIONS', label: 'Submitted validation' },

  // IP & Patents — the founder's own registry actions
  IP_RECORD_CREATED: { category: 'IP', label: 'Added an IP record' },
  IP_RECORD_UPDATED: { category: 'IP', label: 'Updated an IP record' },
  IP_RECORD_SUBMITTED: { category: 'IP', label: 'Submitted an IP record for review' },
  IP_RECORD_UNPUBLISHED: { category: 'IP', label: 'Removed an IP record from the public registry' },
  IP_RECORD_DELETED: { category: 'IP', label: 'Deleted an IP record' },

  // Reports
  REPORT_DOWNLOADED: { category: 'REPORTS', label: 'Downloaded validation report' },

  // Admin actions — the admin is accountable to the same log as everyone else
  ADMIN_VALIDATOR_APPROVED: { category: 'ADMIN', label: 'Approved validator' },
  ADMIN_VALIDATOR_REJECTED: { category: 'ADMIN', label: 'Rejected validator' },
  ADMIN_USER_ACTIVATED: { category: 'ADMIN', label: 'Activated user' },
  ADMIN_USER_DEACTIVATED: { category: 'ADMIN', label: 'Deactivated user' },
  ADMIN_USER_DELETED: { category: 'ADMIN', label: 'Deleted user and all their data' },
  ADMIN_IDEA_DELETED: { category: 'ADMIN', label: 'Deleted idea' },
  ADMIN_DASHBOARD_UNLOCKED: { category: 'ADMIN', label: 'Unlocked dashboard early' },
  ADMIN_DASHBOARD_RELOCKED: { category: 'ADMIN', label: 'Restored dashboard timer' },
  VIEW_AS_USER_STARTED: { category: 'ADMIN', label: 'Started viewing as user' },
  VIEW_AS_USER_ENDED: { category: 'ADMIN', label: 'Stopped viewing as user' },
  ADMIN_SURVEY_STATUS_CHANGED: { category: 'ADMIN', label: 'Changed survey status' },
  ADMIN_SURVEY_DELETED: { category: 'ADMIN', label: 'Deleted survey' },
  ADMIN_IP_APPROVED: { category: 'ADMIN', label: 'Approved IP record for the public registry' },
  ADMIN_IP_REJECTED: { category: 'ADMIN', label: 'Rejected IP record' },
  ADMIN_IP_CHANGES_REQUESTED: { category: 'ADMIN', label: 'Requested changes to IP record' },
};

export const ACTIVITY_CATEGORIES = ['ACCOUNT', 'IDEAS', 'SURVEYS', 'RESPONSES', 'VALIDATIONS', 'IP', 'REPORTS', 'ADMIN'];
export const ACTOR_ROLES = ['FOUNDER', 'VALIDATOR', 'RESPONDENT', 'ADMIN'];

const ANONYMOUS_LABEL = 'Anonymous respondent';

export interface LogInput {
  /** null/undefined for anonymous respondents, who have no account by design. */
  userId?: string | null;
  actorRole: string;
  actorLabel?: string | null;
  action: keyof typeof ACTION_CATALOG | string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  /** The founder who owns the target, so it also shows on their profile. */
  ownerUserId?: string | null;
  /** Platform facts only — ids, counts, statuses. Never personal data. */
  metadata?: Record<string, any>;
}

interface FeedFilters {
  search?: string;
  role?: string;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Records one meaningful action. Never throws and never rejects: an activity
   * write must not be able to fail a signup, a survey submission or any other
   * real user action. Callers fire this without awaiting.
   */
  async log(input: LogInput): Promise<void> {
    try {
      // An admin browsing in View-as-User mode must never create feed events
      // in the viewed user's name (e.g. IDEA_RESULTS_VIEWED, VALIDATION_OPENED)
      // — those would forge the user's own history. The admin's start/end of
      // view mode is logged from /admin routes, where this context is not set.
      if (isViewAsRequest()) return;

      const entry = ACTION_CATALOG[input.action];
      if (!entry) {
        // An unknown action is a bug in the caller, not a reason to fail their request.
        this.logger.warn(`Ignoring unknown activity action: ${input.action}`);
        return;
      }

      await this.prisma.activity.create({
        data: {
          userId: input.userId || null,
          actorRole: input.actorRole,
          actorLabel: input.actorLabel?.trim() || ANONYMOUS_LABEL,
          action: String(input.action),
          category: entry.category,
          targetType: input.targetType || null,
          targetId: input.targetId || null,
          targetLabel: input.targetLabel || null,
          ownerUserId: input.ownerUserId || null,
          metadata: JSON.stringify(input.metadata || {}),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Activity log failed (${input.action}): ${err?.message}`);
    }
  }

  private parseMetadata(raw: string) {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return {};
    }
  }

  private shape(a: any) {
    const entry = ACTION_CATALOG[a.action];
    return {
      id: a.id,
      userId: a.userId,
      actorLabel: a.actorLabel,
      actorRole: a.actorRole,
      actorEmail: a.user?.email || null,
      action: a.action,
      actionLabel: entry?.label || a.action,
      category: a.category,
      targetType: a.targetType,
      targetId: a.targetId,
      targetLabel: a.targetLabel,
      ownerUserId: a.ownerUserId,
      metadata: this.parseMetadata(a.metadata),
      createdAt: a.createdAt,
    };
  }

  private dateWindow(from?: string, to?: string) {
    const window: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) window.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) window.lte = d;
    }
    return Object.keys(window).length ? window : undefined;
  }

  async getFeed(filters: FeedFilters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 50));

    const where: any = {};
    if (filters.role && filters.role !== 'ALL') where.actorRole = filters.role;
    if (filters.category && filters.category !== 'ALL') where.category = filters.category;

    const createdAt = this.dateWindow(filters.from, filters.to);
    if (createdAt) where.createdAt = createdAt;

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { actorLabel: { contains: search, mode: 'insensitive' } },
        { targetLabel: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.shape(r)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Today's platform summary. Counts that describe real platform objects come
   * straight from their own tables (Idea/Survey/SurveyResponse) rather than
   * from the log, so the numbers are correct even for activity that happened
   * before this feature existed.
   */
  async getSummary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalActivities, activeUsers, validatorsActive, ideasCreated, surveysCreated, responsesSubmitted] =
      await Promise.all([
        this.prisma.activity.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.activity.findMany({
          where: { createdAt: { gte: startOfToday }, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.activity.findMany({
          where: { createdAt: { gte: startOfToday }, actorRole: 'VALIDATOR', userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.idea.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.survey.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.surveyResponse.count({ where: { submittedAt: { gte: startOfToday } } }),
      ]);

    return {
      totalActivities,
      activeUsers: activeUsers.length,
      validatorsActive: validatorsActive.length,
      ideasCreated,
      surveysCreated,
      responsesSubmitted,
    };
  }

  /**
   * One activity plus the current state of whatever it acted on. Only ever
   * returns platform data that already exists — no personal information beyond
   * the acting account's own name/email, and nothing at all for anonymous
   * respondents beyond which survey they interacted with.
   */
  async getDetail(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true, createdAt: true } } },
    });
    if (!activity) return null;

    const base = this.shape(activity);
    let target: any = null;

    if (activity.targetType === 'SURVEY' && activity.targetId) {
      const survey = await this.prisma.survey.findUnique({
        where: { id: activity.targetId },
        select: {
          id: true, title: true, status: true, publicId: true, versionNumber: true, createdAt: true,
          founder: { select: { id: true, name: true } },
          _count: { select: { questions: true, responses: true } },
        },
      });
      if (survey) {
        target = {
          kind: 'SURVEY',
          id: survey.id,
          title: survey.title,
          status: survey.status,
          versionNumber: survey.versionNumber,
          createdAt: survey.createdAt,
          creator: survey.founder,
          questionCount: survey._count.questions,
          responseCount: survey._count.responses,
          href: `/admin/surveys/${survey.id}`,
        };
      }
    } else if (activity.targetType === 'IDEA' && activity.targetId) {
      const idea = await this.prisma.idea.findUnique({
        where: { id: activity.targetId },
        select: {
          id: true, title: true, industryCategory: true, stage: true, paymentStatus: true,
          version: true, createdAt: true,
          founder: { select: { id: true, name: true } },
          _count: { select: { validations: true, surveys: true } },
        },
      });
      if (idea) {
        target = {
          kind: 'IDEA',
          id: idea.id,
          title: idea.title,
          industryCategory: idea.industryCategory,
          stage: idea.stage,
          status: idea.paymentStatus,
          version: idea.version,
          createdAt: idea.createdAt,
          creator: idea.founder,
          validationCount: idea._count.validations,
          surveyCount: idea._count.surveys,
          href: `/admin/ideas/${idea.id}`,
        };
      }
    } else if (activity.targetType === 'VALIDATION' && activity.targetId) {
      const validation = await this.prisma.validationResponse.findUnique({
        where: { id: activity.targetId },
        select: {
          id: true, createdAt: true,
          validator: { select: { id: true, name: true } },
          idea: { select: { id: true, title: true } },
        },
      });
      if (validation) {
        target = {
          kind: 'VALIDATION',
          id: validation.id,
          title: validation.idea.title,
          createdAt: validation.createdAt,
          validator: validation.validator,
          href: `/admin/ideas/${validation.idea.id}`,
        };
      }
    } else if (activity.targetType === 'USER' && activity.targetId) {
      const user = await this.prisma.user.findUnique({
        where: { id: activity.targetId },
        select: { id: true, name: true, role: true, isActive: true, createdAt: true },
      });
      if (user) {
        target = {
          kind: 'USER',
          id: user.id,
          title: user.name,
          status: user.isActive ? 'Active' : 'Inactive',
          role: user.role,
          createdAt: user.createdAt,
          href: `/admin/users/${user.id}`,
        };
      }
    }

    return {
      ...base,
      actor: activity.user
        ? {
            id: activity.user.id,
            name: activity.user.name,
            email: activity.user.email,
            role: activity.user.role,
            accountCreated: activity.user.createdAt,
            href: `/admin/users/${activity.user.id}`,
          }
        : null,
      target,
    };
  }

  /**
   * A single user's history. Includes activity they performed *and* activity
   * performed on things they own (e.g. a response submitted to their survey),
   * which is what makes "received a survey response" appear on a founder's
   * profile without writing a second duplicate row.
   */
  async getForUser(userId: string, limit = 100) {
    const rows = await this.prisma.activity.findMany({
      where: { OR: [{ userId }, { ownerUserId: userId }] },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(300, Math.max(1, limit)),
    });

    return rows.map((r) => ({
      ...this.shape(r),
      // Distinguishes "they did this" from "this happened to something of theirs".
      isOwnAction: r.userId === userId,
    }));
  }

  /** Activity for one target object, used by the idea/survey detail pages. */
  async getForTarget(targetType: string, targetId: string, limit = 50) {
    const rows = await this.prisma.activity.findMany({
      where: { targetType, targetId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return rows.map((r) => this.shape(r));
  }
}
