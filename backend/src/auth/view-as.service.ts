import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

export interface ViewAsPayload {
  typ: 'view-as';
  adminId: string;
  targetUserId: string;
  targetRole: string;
  exp?: number;
}

const VIEW_AS_TTL = '30m';

/**
 * "View as User": a second, short-lived credential the admin presents
 * ALONGSIDE their own JWT (never instead of it). The token is bound to the
 * issuing admin's id, so it is worthless without that admin's real session
 * and worthless to any other admin. Nothing is stored server-side — expiry
 * is the JWT's own exp claim, and "revocation" is the client discarding it.
 */
@Injectable()
export class ViewAsService {
  constructor(private jwt: JwtService, private prisma: PrismaService, private activity: ActivityService) {}

  async start(adminId: string, targetUserId: string) {
    if (targetUserId === adminId) throw new ForbiddenException('You cannot view your own account');

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (!target) throw new NotFoundException('User not found');
    // Admin accounts are never viewable — an impersonated admin identity
    // would inherit admin routes, which this feature must never grant.
    if (target.role === 'ADMIN') throw new ForbiddenException('Admin accounts cannot be viewed');

    const payload: ViewAsPayload = { typ: 'view-as', adminId, targetUserId: target.id, targetRole: target.role };
    const viewToken = this.jwt.sign(payload, { expiresIn: VIEW_AS_TTL });
    const decoded = this.jwt.decode(viewToken) as ViewAsPayload;

    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { name: true } });
    void this.activity.log({
      userId: adminId,
      actorRole: 'ADMIN',
      actorLabel: admin?.name || 'Admin',
      action: 'VIEW_AS_USER_STARTED',
      targetType: 'USER',
      targetId: target.id,
      targetLabel: target.name,
      metadata: { targetRole: target.role, targetActive: target.isActive },
    });

    return {
      viewToken,
      expiresAt: new Date((decoded.exp || 0) * 1000),
      target: { id: target.id, name: target.name, role: target.role, isActive: target.isActive },
    };
  }

  async end(adminId: string, targetUserId: string) {
    // The token was already discarded client-side — this endpoint exists for
    // the audit trail, so it validates just enough to log truthfully.
    const [admin, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: adminId }, select: { name: true } }),
      targetUserId
        ? this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ]);

    void this.activity.log({
      userId: adminId,
      actorRole: 'ADMIN',
      actorLabel: admin?.name || 'Admin',
      action: 'VIEW_AS_USER_ENDED',
      targetType: 'USER',
      targetId: target?.id || null,
      targetLabel: target?.name || null,
      metadata: {},
    });

    return { success: true };
  }

  /**
   * Verifies an X-View-As token. Throws UnauthorizedException with a
   * machine-readable `code` so the frontend can distinguish "view session
   * expired" (return to /admin gracefully) from a real auth failure.
   */
  verify(token: string): ViewAsPayload {
    try {
      const payload = this.jwt.verify<ViewAsPayload>(token);
      if (payload.typ !== 'view-as') throw new Error('wrong type');
      return payload;
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({ message: 'View as User session expired', code: 'VIEW_AS_EXPIRED' });
      }
      throw new UnauthorizedException({ message: 'Invalid view session', code: 'VIEW_AS_INVALID' });
    }
  }
}
