import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdeasService } from '../ideas/ideas.service';
import { UpsertStartupDto, ReviewStartupDto, LOOKING_FOR_OPTIONS } from './dto/startup.dto';

// Only these three keys are ever honoured from the founder's validation-display
// settings, and only as booleans — a crafted payload can't publish anything else.
const VALIDATION_DISPLAY_DEFAULTS = {
  showScore: false,
  showValidatorCount: false,
  showCustomerValidation: false,
};

@Injectable()
export class StartupsService {
  constructor(private prisma: PrismaService, private ideasService: IdeasService) {}

  // ---------- helpers ----------

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      const v = JSON.parse(raw || '');
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  private sanitizeDisplay(raw: any) {
    const out = { ...VALIDATION_DISPLAY_DEFAULTS };
    for (const key of Object.keys(VALIDATION_DISPLAY_DEFAULTS)) {
      if (typeof raw?.[key] === 'boolean') (out as any)[key] = raw[key];
    }
    return out;
  }

  private slugify(name: string) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'startup'
    );
  }

  // Slugs must be unique and stable. `excludeId` lets a row keep its own slug
  // when re-checking during an update.
  private async uniqueSlug(base: string, excludeId?: string) {
    const root = this.slugify(base);
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      const clash = await this.prisma.startup.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!clash || clash.id === excludeId) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  /**
   * THE listing gate. Deliberately reuses the exact condition that already
   * unlocks the validation report on the founder's dashboard — a paid idea with
   * at least one expert validation — rather than introducing a second notion of
   * "validated" that could drift out of sync.
   */
  private async loadEligibleIdea(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        founder: { select: { id: true, name: true } },
        _count: { select: { validations: true } },
      },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new ForbiddenException('Access denied');
    if (idea.paymentStatus !== 'COMPLETED' || idea._count.validations === 0) {
      throw new ForbiddenException(
        'You can list your startup once your idea has been validated by our experts.'
      );
    }
    return idea;
  }

  // What the founder sees about their own listing — includes reviewMessage
  // (they need it to act on "changes requested") but never adminNote.
  private founderView(s: any) {
    if (!s) return null;
    return {
      id: s.id,
      slug: s.slug,
      status: s.status,
      name: s.name,
      logoUrl: s.logoUrl,
      tagline: s.tagline,
      about: s.about,
      problem: s.problem,
      solution: s.solution,
      product: s.product,
      traction: s.traction,
      industry: s.industry,
      location: s.location,
      foundedYear: s.foundedYear,
      website: s.website,
      linkedinUrl: s.linkedinUrl,
      stage: s.stage,
      teamMembers: this.parseJson<any[]>(s.teamMembers, []),
      lookingFor: this.parseJson<string[]>(s.lookingFor, []),
      validationDisplay: this.sanitizeDisplay(this.parseJson<any>(s.validationDisplay, {})),
      reviewMessage: s.reviewMessage,
      submittedAt: s.submittedAt,
      reviewedAt: s.reviewedAt,
      updatedAt: s.updatedAt,
    };
  }

  // ---------- founder ----------

  async getForIdea(ideaId: string, founderId: string) {
    const idea = await this.loadEligibleIdea(ideaId, founderId);
    const existing = await this.prisma.startup.findUnique({ where: { ideaId } });

    // Prefill straight from the idea the founder already filled in, so the
    // form opens mostly complete rather than blank.
    const prefill = {
      name: idea.title,
      problem: idea.problemStatement,
      solution: idea.solutionDescription,
      industry: idea.industryCategory,
      stage: idea.stage,
      teamMembers: this.parseJson<any[]>(idea.teamMembers, []),
      founderName: idea.founder.name,
    };

    return { eligible: true, startup: this.founderView(existing), prefill };
  }

  async upsertForIdea(ideaId: string, founderId: string, dto: UpsertStartupDto) {
    await this.loadEligibleIdea(ideaId, founderId);
    const existing = await this.prisma.startup.findUnique({ where: { ideaId } });

    // An approved listing is live to the public; editing it would silently
    // change public content with no review. Keep the MVP honest: approved
    // listings are locked until an admin is involved again.
    if (existing?.status === 'APPROVED') {
      throw new BadRequestException(
        'This startup is already published. Contact support to make changes to a live listing.'
      );
    }
    if (existing?.status === 'REJECTED') {
      throw new BadRequestException('This listing was rejected and can no longer be edited.');
    }

    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Startup name is required.');

    if (dto.submit) {
      // Only the fields a public profile genuinely cannot do without.
      const missing: string[] = [];
      if (!dto.tagline?.trim()) missing.push('one-line description');
      if (!dto.industry?.trim()) missing.push('industry');
      if (!dto.location?.trim()) missing.push('location');
      if (!dto.problem?.trim()) missing.push('problem');
      if (!dto.solution?.trim()) missing.push('solution');
      if (missing.length) {
        throw new BadRequestException(`Please fill in: ${missing.join(', ')}.`);
      }
    }

    const lookingFor = (dto.lookingFor || []).filter((x) => LOOKING_FOR_OPTIONS.includes(x));

    const data = {
      name,
      logoUrl: dto.logoUrl ?? existing?.logoUrl ?? '',
      tagline: dto.tagline ?? '',
      about: dto.about ?? '',
      problem: dto.problem ?? '',
      solution: dto.solution ?? '',
      product: dto.product ?? '',
      traction: dto.traction ?? '',
      industry: dto.industry ?? '',
      location: dto.location ?? '',
      foundedYear: dto.foundedYear ?? null,
      website: dto.website ?? '',
      linkedinUrl: dto.linkedinUrl ?? '',
      stage: dto.stage ?? 'IDEA',
      teamMembers: JSON.stringify(dto.teamMembers ?? []),
      lookingFor: JSON.stringify(lookingFor),
      validationDisplay: JSON.stringify(this.sanitizeDisplay(dto.validationDisplay)),
      status: dto.submit ? 'PENDING_REVIEW' : existing?.status ?? 'DRAFT',
      submittedAt: dto.submit ? new Date() : existing?.submittedAt ?? null,
      // Resubmitting clears the previous round's feedback so stale guidance
      // never lingers on the founder's dashboard.
      reviewMessage: dto.submit ? '' : existing?.reviewMessage ?? '',
    };

    const saved = existing
      ? await this.prisma.startup.update({ where: { id: existing.id }, data })
      : await this.prisma.startup.create({
          data: { ...data, ideaId, founderId, slug: await this.uniqueSlug(name) },
        });

    return this.founderView(saved);
  }

  // ---------- admin ----------

  async adminList(status?: string) {
    const rows = await this.prisma.startup.findMany({
      where: status && status !== 'ALL' ? { status } : {},
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        founder: { select: { id: true, name: true, email: true } },
        idea: { select: { id: true, title: true } },
      },
    });

    // Validation score is what an admin reviews against, so resolve it per row.
    return Promise.all(
      rows.map(async (s) => {
        const v = await this.ideasService.publicValidationSummary(s.ideaId);
        return {
          id: s.id,
          name: s.name,
          slug: s.slug,
          status: s.status,
          industry: s.industry,
          location: s.location,
          submittedAt: s.submittedAt,
          createdAt: s.createdAt,
          founder: s.founder,
          ideaId: s.ideaId,
          ideaTitle: s.idea.title,
          validationScore: v?.score ?? null,
          validatorCount: v?.validatorCount ?? 0,
        };
      })
    );
  }

  async adminDetail(id: string) {
    const s = await this.prisma.startup.findUnique({
      where: { id },
      include: {
        founder: { select: { id: true, name: true, email: true } },
        idea: { select: { id: true, title: true, industryCategory: true, stage: true } },
      },
    });
    if (!s) throw new NotFoundException('Startup not found');
    const validation = await this.ideasService.publicValidationSummary(s.ideaId);

    return {
      ...this.founderView(s),
      adminNote: s.adminNote, // ADMIN-guarded route only
      founder: s.founder,
      idea: s.idea,
      validation,
    };
  }

  async review(id: string, dto: ReviewStartupDto) {
    const s = await this.prisma.startup.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Startup not found');

    if (dto.action === 'REQUEST_CHANGES' && !dto.reviewMessage?.trim()) {
      throw new BadRequestException('Tell the founder what needs changing.');
    }

    const status =
      dto.action === 'APPROVE' ? 'APPROVED' : dto.action === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED';

    // Re-resolve the slug on approval: the name may have changed since the row
    // was created, and the slug is the public URL from this moment on.
    const slug = status === 'APPROVED' ? await this.uniqueSlug(s.name, s.id) : s.slug;

    const updated = await this.prisma.startup.update({
      where: { id },
      data: {
        status,
        slug,
        reviewMessage: dto.reviewMessage?.trim() ?? '',
        adminNote: dto.adminNote?.trim() ?? s.adminNote,
        reviewedAt: new Date(),
      },
    });
    return { success: true, status: updated.status, slug: updated.slug };
  }

  // ---------- public ----------

  async publicList(filters: { industry?: string; location?: string; stage?: string; lookingFor?: string }) {
    const rows = await this.prisma.startup.findMany({
      where: {
        status: 'APPROVED', // enforced in the query itself — a draft can never leak
        ...(filters.industry ? { industry: filters.industry } : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.location ? { location: { contains: filters.location, mode: 'insensitive' as const } } : {}),
        ...(filters.lookingFor ? { lookingFor: { contains: filters.lookingFor } } : {}),
      },
      orderBy: { reviewedAt: 'desc' },
      select: {
        slug: true, name: true, logoUrl: true, tagline: true, industry: true,
        location: true, stage: true, lookingFor: true, ideaId: true, validationDisplay: true,
      },
    });

    // Cards show only a "validated" marker (plus the score if opted in) —
    // never counts or customer data, which live on the profile.
    const cards = await Promise.all(
      rows.map(async (s) => {
        const display = this.sanitizeDisplay(this.parseJson<any>(s.validationDisplay, {}));
        const v = await this.ideasService.publicValidationSummary(s.ideaId);
        return {
          slug: s.slug,
          name: s.name,
          logoUrl: s.logoUrl,
          tagline: s.tagline,
          industry: s.industry,
          location: s.location,
          stage: s.stage,
          lookingFor: this.parseJson<string[]>(s.lookingFor, []),
          validated: !!v,
          score: display.showScore ? v?.score ?? null : null,
        };
      })
    );

    return {
      startups: cards,
      // Filter options derived from what's actually listed, so the dropdowns
      // never offer a choice that returns nothing.
      filters: {
        industries: [...new Set(cards.map((c) => c.industry).filter(Boolean))].sort(),
        locations: [...new Set(cards.map((c) => c.location).filter(Boolean))].sort(),
        stages: [...new Set(cards.map((c) => c.stage).filter(Boolean))],
      },
    };
  }

  /**
   * Public profile. Built as an explicit whitelist rather than by spreading the
   * row: nothing about the founder's account, the private report, validator
   * identities, survey answers or admin notes can reach this payload, and the
   * validation block only appears for aggregates the founder opted into.
   */
  async publicProfile(slug: string) {
    const s = await this.prisma.startup.findFirst({
      where: { slug, status: 'APPROVED' },
    });
    if (!s) throw new NotFoundException('Startup not found');

    const display = this.sanitizeDisplay(this.parseJson<any>(s.validationDisplay, {}));
    const summary = await this.ideasService.publicValidationSummary(s.ideaId);

    const validation =
      summary && (display.showScore || display.showValidatorCount || display.showCustomerValidation)
        ? {
            score: display.showScore ? summary.score : null,
            validatorCount: display.showValidatorCount ? summary.validatorCount : null,
            customerValidation: display.showCustomerValidation ? summary.customerValidation : null,
          }
        : null;

    return {
      slug: s.slug,
      name: s.name,
      logoUrl: s.logoUrl,
      tagline: s.tagline,
      about: s.about,
      problem: s.problem,
      solution: s.solution,
      product: s.product,
      traction: s.traction,
      industry: s.industry,
      location: s.location,
      foundedYear: s.foundedYear,
      website: s.website,
      linkedinUrl: s.linkedinUrl,
      stage: s.stage,
      teamMembers: this.parseJson<any[]>(s.teamMembers, []),
      lookingFor: this.parseJson<string[]>(s.lookingFor, []),
      // Present only when the startup has been through expert validation AND
      // the founder chose to show at least one number.
      validated: !!summary,
      validation,
      listedAt: s.reviewedAt,
    };
  }
}
