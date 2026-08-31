import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { UpsertIpRecordDto, AddIpDocumentDto, ReviewIpRecordDto } from './dto/ip.dto';
import {
  IP_TYPES, IP_STATUSES, APPLIED_STATUSES, PENDING_STATUSES, PUBLIC_FIELD_DEFAULTS,
  FOCUS_STATE, IP_DISCLAIMER,
} from './ip.constants';
import { toPublicIpRecord, parsePublicFields, publicFacingSignature, PUBLIC_SELECT } from './ip-public.util';
import {
  canonicalCity, canonicalInstitution, isFocusState, countBy, monthlySeries, normalizeText,
} from './gujarat.util';

/**
 * Innovation & Patent Registry.
 *
 * Publication requires BOTH locks to be open — the founder's `visibility` and
 * the admin's `reviewStatus` — and both are applied in the Prisma `where` of
 * every public query (PUBLIC_WHERE below). Nothing is filtered in JavaScript
 * after the fetch, so a bug in a serializer cannot put a record on the public
 * registry that an admin never approved.
 *
 * Nothing in here verifies anything with a patent office. Every value is
 * founder-reported and every payload carries IP_DISCLAIMER saying so.
 */
const PUBLIC_WHERE = { visibility: 'PUBLIC', reviewStatus: 'APPROVED' } as const;

@Injectable()
export class IpService {
  constructor(private prisma: PrismaService, private activity: ActivityService) {}

  // ---------- helpers ----------

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      const v = JSON.parse(raw || '');
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  private sanitizePublicFields(raw: any): string {
    const out = { ...PUBLIC_FIELD_DEFAULTS };
    for (const key of Object.keys(PUBLIC_FIELD_DEFAULTS)) {
      if (typeof raw?.[key] === 'boolean') out[key] = raw[key];
    }
    return JSON.stringify(out);
  }

  /**
   * The founder's own view of their record — everything they wrote, documents
   * included. Only ever reached through the ownership check in ownedOrThrow.
   */
  private founderView(row: any) {
    return {
      id: row.id,
      ideaId: row.ideaId,
      ideaTitle: row.idea?.title ?? null,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      applicationNumber: row.applicationNumber,
      filingDate: row.filingDate,
      jurisdiction: row.jurisdiction,
      inventorNames: this.parseJson<string[]>(row.inventorNames, []),
      ownerName: row.ownerName,
      authority: row.authority,
      publicUrl: row.publicUrl,
      notes: row.notes,
      city: row.city,
      state: row.state,
      institution: row.institution,
      visibility: row.visibility,
      publicFields: parsePublicFields(row.publicFields),
      reviewStatus: row.reviewStatus,
      reviewMessage: row.reviewMessage,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      // Live on the public registry right now? Same two-lock rule as the query.
      isLive: row.visibility === 'PUBLIC' && row.reviewStatus === 'APPROVED',
      documents: (row.documents ?? []).map((d: any) => ({
        id: d.id,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        documentType: d.documentType,
        createdAt: d.createdAt,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      disclaimer: IP_DISCLAIMER,
    };
  }

  /**
   * Ownership gate. Someone else's record raises 404, not 403, so an id cannot
   * be probed for existence — the same choice the ideas service makes.
   */
  private async ownedOrThrow(id: string, founderId: string) {
    const row = await this.prisma.ipRecord.findUnique({
      where: { id },
      include: { documents: { orderBy: { createdAt: 'asc' } }, idea: { select: { title: true } } },
    });
    if (!row || row.founderId !== founderId) throw new NotFoundException('IP record not found');
    return row;
  }

  /** An idea can only be attached to a record by the founder who owns it. */
  private async assertIdeaOwned(ideaId: string | undefined, founderId: string): Promise<string | null> {
    if (!ideaId) return null;
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId }, select: { founderId: true } });
    if (!idea || idea.founderId !== founderId) throw new BadRequestException('Idea not found');
    return ideaId;
  }

  /** DTO to column values. Shared by create and update so the two cannot drift. */
  private toColumns(dto: UpsertIpRecordDto, ideaId: string | null) {
    return {
      ideaId,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      type: dto.type,
      status: dto.status ?? 'PLANNED',
      applicationNumber: dto.applicationNumber?.trim() ?? '',
      filingDate: dto.filingDate ? new Date(dto.filingDate) : null,
      jurisdiction: dto.jurisdiction?.trim() ?? '',
      inventorNames: JSON.stringify((dto.inventorNames ?? []).map((n) => n.trim()).filter(Boolean)),
      ownerName: dto.ownerName?.trim() ?? '',
      authority: dto.authority?.trim() ?? '',
      publicUrl: dto.publicUrl?.trim() ?? '',
      notes: dto.notes?.trim() ?? '',
      city: canonicalCity(dto.city),
      state: dto.state ?? '',
      institution: canonicalInstitution(dto.institution),
      publicFields: this.sanitizePublicFields(dto.publicFields),
    };
  }

  // ---------- founder ----------

  async create(founderId: string, dto: UpsertIpRecordDto) {
    const ideaId = await this.assertIdeaOwned(dto.ideaId, founderId);
    const columns = this.toColumns(dto, ideaId);
    const wantsPublic = !!dto.makePublic;

    const created = await this.prisma.ipRecord.create({
      data: {
        ...columns,
        founderId,
        // Asking to publish only ever puts the record in the review queue.
        // APPROVED is unreachable from this payload — it is an admin action.
        visibility: wantsPublic ? 'PUBLIC' : 'PRIVATE',
        reviewStatus: wantsPublic ? 'PENDING_REVIEW' : 'DRAFT',
        submittedAt: wantsPublic ? new Date() : null,
      },
      include: { documents: true, idea: { select: { title: true } } },
    });

    await this.activity.log({
      userId: founderId,
      actorRole: 'FOUNDER',
      action: 'IP_RECORD_CREATED',
      targetType: 'IP_RECORD',
      targetId: created.id,
      targetLabel: created.title,
    });
    if (wantsPublic) await this.logSubmitted(founderId, created.id, created.title);

    return this.founderView(created);
  }

  async listForFounder(founderId: string) {
    const rows = await this.prisma.ipRecord.findMany({
      where: { founderId },
      orderBy: { updatedAt: 'desc' },
      include: { documents: { orderBy: { createdAt: 'asc' } }, idea: { select: { title: true } } },
    });
    return { records: rows.map((r) => this.founderView(r)), disclaimer: IP_DISCLAIMER };
  }

  async getOne(id: string, founderId: string) {
    return this.founderView(await this.ownedOrThrow(id, founderId));
  }

  async update(id: string, founderId: string, dto: UpsertIpRecordDto) {
    const existing = await this.ownedOrThrow(id, founderId);
    const ideaId = await this.assertIdeaOwned(dto.ideaId, founderId);
    const columns = this.toColumns(dto, ideaId);
    const wantsPublic = !!dto.makePublic;

    let reviewStatus = existing.reviewStatus;
    let submittedAt = existing.submittedAt;

    if (!wantsPublic) {
      // Un-ticking "make public" pulls the record off the registry at once and
      // returns it to DRAFT — taking something down never waits on an admin.
      reviewStatus = 'DRAFT';
      submittedAt = null;
    } else if (existing.reviewStatus === 'APPROVED') {
      // Already live. Only a change to something the public can actually see
      // sends it back for review; editing private notes must not cost the
      // founder an approval they already earned.
      const changed = publicFacingSignature({ ...existing, ...columns }) !== publicFacingSignature(existing);
      if (changed) {
        reviewStatus = 'PENDING_REVIEW';
        submittedAt = new Date();
      }
    } else if (existing.reviewStatus !== 'PENDING_REVIEW') {
      // DRAFT, CHANGES_REQUESTED or REJECTED — this is a (re)submission.
      reviewStatus = 'PENDING_REVIEW';
      submittedAt = new Date();
    }

    const updated = await this.prisma.ipRecord.update({
      where: { id },
      data: {
        ...columns,
        visibility: wantsPublic ? 'PUBLIC' : 'PRIVATE',
        reviewStatus,
        submittedAt,
        // A fresh submission clears the old verdict so the founder is not left
        // staring at feedback they have already acted on.
        reviewMessage: reviewStatus === 'PENDING_REVIEW' ? '' : existing.reviewMessage,
      },
      include: { documents: { orderBy: { createdAt: 'asc' } }, idea: { select: { title: true } } },
    });

    await this.activity.log({
      userId: founderId,
      actorRole: 'FOUNDER',
      action: 'IP_RECORD_UPDATED',
      targetType: 'IP_RECORD',
      targetId: id,
      targetLabel: updated.title,
    });
    if (reviewStatus === 'PENDING_REVIEW' && existing.reviewStatus !== 'PENDING_REVIEW') {
      await this.logSubmitted(founderId, id, updated.title);
    }
    if (!wantsPublic && existing.visibility === 'PUBLIC') {
      await this.activity.log({
        userId: founderId,
        actorRole: 'FOUNDER',
        action: 'IP_RECORD_UNPUBLISHED',
        targetType: 'IP_RECORD',
        targetId: id,
        targetLabel: updated.title,
      });
    }

    return this.founderView(updated);
  }

  async remove(id: string, founderId: string) {
    const existing = await this.ownedOrThrow(id, founderId);
    await this.prisma.ipRecord.delete({ where: { id } }); // documents cascade
    await this.activity.log({
      userId: founderId,
      actorRole: 'FOUNDER',
      action: 'IP_RECORD_DELETED',
      targetType: 'IP_RECORD',
      targetId: id,
      targetLabel: existing.title,
    });
    return { success: true };
  }

  private async logSubmitted(founderId: string, id: string, title: string) {
    await this.activity.log({
      userId: founderId,
      actorRole: 'FOUNDER',
      action: 'IP_RECORD_SUBMITTED',
      targetType: 'IP_RECORD',
      targetId: id,
      targetLabel: title,
    });
  }

  // ---------- documents ----------
  //
  // Documents are never part of any public payload — no opt-in, no exception.
  // Only the owning founder (here) and an admin (adminDetail) see a file URL.

  async addDocument(id: string, founderId: string, dto: AddIpDocumentDto) {
    await this.ownedOrThrow(id, founderId);
    await this.prisma.ipDocument.create({
      data: {
        ipRecordId: id,
        fileUrl: dto.fileUrl.trim(),
        fileName: dto.fileName.trim(),
        documentType: dto.documentType ?? 'OTHER',
      },
    });
    return this.getOne(id, founderId);
  }

  async removeDocument(id: string, documentId: string, founderId: string) {
    await this.ownedOrThrow(id, founderId);
    const doc = await this.prisma.ipDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.ipRecordId !== id) throw new NotFoundException('Document not found');
    await this.prisma.ipDocument.delete({ where: { id: documentId } });
    return this.getOne(id, founderId);
  }

  // ---------- public ----------

  async publicList(filters: { type?: string; status?: string; state?: string; industry?: string; q?: string }) {
    const q = normalizeText(filters.q);
    const rows = await this.prisma.ipRecord.findMany({
      where: {
        ...PUBLIC_WHERE, // both locks, in the query itself
        ...(filters.type && IP_TYPES.includes(filters.type as any) ? { type: filters.type } : {}),
        ...(filters.status && IP_STATUSES.includes(filters.status as any) ? { status: filters.status } : {}),
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.industry ? { idea: { industryCategory: filters.industry } } : {}),
        // Search spans only fields that are public anyway. Searching by
        // application number here would confirm a private value by its hits.
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
      select: PUBLIC_SELECT,
    });

    const records = rows.map(toPublicIpRecord);
    return {
      records,
      // Options built from what is actually published, so a dropdown never
      // offers a filter that returns nothing.
      filters: {
        types: [...new Set(records.map((r) => r.type).filter(Boolean))].sort(),
        statuses: [...new Set(records.map((r) => r.status).filter(Boolean))].sort(),
        states: [...new Set(records.map((r) => r.state).filter(Boolean))].sort(),
        industries: [...new Set(records.map((r) => r.industry).filter(Boolean))].sort(),
      },
      disclaimer: IP_DISCLAIMER,
    };
  }

  async publicDetail(id: string) {
    const row = await this.prisma.ipRecord.findFirst({
      where: { id, ...PUBLIC_WHERE },
      select: PUBLIC_SELECT,
    });
    // A private, pending or rejected record is indistinguishable from one that
    // does not exist.
    if (!row) throw new NotFoundException('IP record not found');
    return toPublicIpRecord(row);
  }

  // ---------- admin ----------

  async adminList(filters: {
    reviewStatus?: string; status?: string; type?: string; jurisdiction?: string;
    state?: string; institution?: string; visibility?: string;
    from?: string; to?: string; q?: string;
  }) {
    const q = normalizeText(filters.q);
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;
    const all = (v?: string) => !v || v === 'ALL';

    const rows = await this.prisma.ipRecord.findMany({
      where: {
        ...(all(filters.reviewStatus) ? {} : { reviewStatus: filters.reviewStatus }),
        ...(all(filters.status) ? {} : { status: filters.status }),
        ...(all(filters.type) ? {} : { type: filters.type }),
        ...(all(filters.visibility) ? {} : { visibility: filters.visibility }),
        ...(all(filters.state) ? {} : { state: filters.state }),
        ...(filters.jurisdiction
          ? { jurisdiction: { contains: filters.jurisdiction, mode: 'insensitive' as const } }
          : {}),
        ...(filters.institution
          ? { institution: { contains: filters.institution, mode: 'insensitive' as const } }
          : {}),
        ...(from || to ? { filingDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { applicationNumber: { contains: q, mode: 'insensitive' as const } },
                { founder: { name: { contains: q, mode: 'insensitive' as const } } },
                { founder: { email: { contains: q, mode: 'insensitive' as const } } },
                { idea: { startup: { name: { contains: q, mode: 'insensitive' as const } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        founder: { select: { id: true, name: true, email: true } },
        idea: { select: { id: true, title: true, startup: { select: { name: true, slug: true } } } },
        _count: { select: { documents: true } },
      },
    });

    return {
      records: rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        jurisdiction: r.jurisdiction,
        filingDate: r.filingDate,
        city: r.city,
        state: r.state,
        institution: r.institution,
        visibility: r.visibility,
        reviewStatus: r.reviewStatus,
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
        founder: r.founder,
        startupName: r.idea?.startup?.name ?? null,
        ideaTitle: r.idea?.title ?? null,
        documentCount: r._count.documents,
        isLive: r.visibility === 'PUBLIC' && r.reviewStatus === 'APPROVED',
      })),
      total: rows.length,
    };
  }

  async adminDetail(id: string) {
    const row = await this.prisma.ipRecord.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { createdAt: 'asc' } },
        founder: { select: { id: true, name: true, email: true, phone: true } },
        idea: {
          select: {
            id: true,
            title: true,
            industryCategory: true,
            startup: { select: { name: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('IP record not found');
    return {
      ...this.founderView(row),
      adminNote: row.adminNote, // only ever returned from an ADMIN-guarded route
      founder: row.founder,
      idea: row.idea,
    };
  }

  async review(id: string, adminId: string, dto: ReviewIpRecordDto) {
    const row = await this.prisma.ipRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('IP record not found');
    if (dto.action === 'REQUEST_CHANGES' && !dto.reviewMessage?.trim()) {
      throw new BadRequestException('Tell the founder what needs changing.');
    }

    const reviewStatus =
      dto.action === 'APPROVE' ? 'APPROVED' : dto.action === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED';

    const updated = await this.prisma.ipRecord.update({
      where: { id },
      data: {
        reviewStatus,
        reviewMessage: dto.reviewMessage?.trim() ?? '',
        adminNote: dto.adminNote?.trim() ?? row.adminNote,
        reviewedAt: new Date(),
      },
    });

    await this.activity.log({
      userId: adminId,
      actorRole: 'ADMIN',
      action:
        reviewStatus === 'APPROVED'
          ? 'ADMIN_IP_APPROVED'
          : reviewStatus === 'REJECTED'
            ? 'ADMIN_IP_REJECTED'
            : 'ADMIN_IP_CHANGES_REQUESTED',
      targetType: 'IP_RECORD',
      targetId: id,
      targetLabel: updated.title,
    });

    return {
      success: true,
      reviewStatus: updated.reviewStatus,
      isLive: updated.visibility === 'PUBLIC' && reviewStatus === 'APPROVED',
    };
  }

  // ---------- admin: ecosystem statistics ----------

  /** The shared counting rules, applied to any slice of records. */
  private summarize(rows: { founderId: string; type: string; status: string }[]) {
    return {
      totalRecords: rows.length,
      totalPatents: rows.filter((r) => r.type === 'PATENT').length,
      foundersWithIp: new Set(rows.map((r) => r.founderId)).size,
      applications: rows.filter((r) => APPLIED_STATUSES.includes(r.status)).length,
      granted: rows.filter((r) => r.status === 'GRANTED').length,
      pending: rows.filter((r) => PENDING_STATUSES.includes(r.status)).length,
      rejectedOrExpired: rows.filter((r) => r.status === 'REJECTED' || r.status === 'EXPIRED').length,
    };
  }

  /** Headline counts over every record, regardless of visibility. */
  async stats() {
    const rows = await this.prisma.ipRecord.findMany({
      select: { founderId: true, type: true, status: true },
    });
    return { ...this.summarize(rows), disclaimer: IP_DISCLAIMER };
  }

  /**
   * The ecosystem dashboard, focused on Gujarat.
   *
   * Every location here was chosen by a founder from a fixed dropdown —
   * nothing is inferred from names, emails or free text. Records with no state
   * set are reported as a coverage figure rather than guessed into a bucket,
   * so the Gujarat numbers are never quietly inflated.
   */
  async analytics() {
    const rows = await this.prisma.ipRecord.findMany({
      select: {
        founderId: true, type: true, status: true, state: true, city: true,
        institution: true, jurisdiction: true, filingDate: true, createdAt: true,
        reviewStatus: true, visibility: true,
      },
    });

    const focus = rows.filter((r) => isFocusState(r.state));

    return {
      focusState: FOCUS_STATE,
      overall: this.summarize(rows),
      focus: {
        ...this.summarize(focus),
        citiesRepresented: new Set(focus.map((r) => canonicalCity(r.city)).filter(Boolean)).size,
        institutionsRepresented: new Set(focus.map((r) => canonicalInstitution(r.institution)).filter(Boolean)).size,
      },
      // Honesty line for the UI: a bare "31" would read as "31 of everyone".
      coverage: {
        totalRecords: rows.length,
        recordsWithState: rows.filter((r) => !!normalizeText(r.state)).length,
        recordsWithCity: rows.filter((r) => !!canonicalCity(r.city)).length,
        recordsWithInstitution: rows.filter((r) => !!canonicalInstitution(r.institution)).length,
      },
      charts: {
        applicationsOverTime: monthlySeries(
          rows.filter((r) => APPLIED_STATUSES.includes(r.status)).map((r) => r.filingDate ?? r.createdAt)
        ),
        typeDistribution: countBy(rows, (r) => r.type),
        statusDistribution: countBy(rows, (r) => r.status),
        focusCityDistribution: countBy(focus, (r) => canonicalCity(r.city)),
        focusInstitutionDistribution: countBy(focus, (r) => canonicalInstitution(r.institution)),
        stateDistribution: countBy(rows, (r) => normalizeText(r.state)),
      },
      queue: {
        pendingReview: rows.filter((r) => r.reviewStatus === 'PENDING_REVIEW').length,
        live: rows.filter((r) => r.reviewStatus === 'APPROVED' && r.visibility === 'PUBLIC').length,
      },
      disclaimer: IP_DISCLAIMER,
    };
  }
}
