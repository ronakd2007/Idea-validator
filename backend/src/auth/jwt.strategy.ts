import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ViewAsService } from './view-as.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private viewAsService: ViewAsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
      // The strategy needs the raw request to see the X-View-As header — the
      // one place identity can be resolved BEFORE RolesGuard evaluates it.
      passReqToCallback: true,
    });
  }

  // Re-checked on every request (tokens live 7 days): deactivating an account
  // cuts its access immediately instead of whenever the token expires, and the
  // role comes from the database so a role change doesn't linger in old tokens.
  async validate(req: any, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Account is deactivated');

    const realIdentity = { userId: user.id, email: user.email, role: user.role };

    // ---- View as User (admin-only, read paths only) ----
    // Substitution never applies on /api/admin routes: the admin portal always
    // operates as the real admin, no matter what headers the client sends.
    const viewToken = req.headers?.['x-view-as'];
    const path: string = req.originalUrl || req.url || '';
    if (!viewToken || typeof viewToken !== 'string' || path.startsWith('/api/admin')) {
      return realIdentity;
    }

    // A view token only works when presented together with the REAL admin JWT
    // that minted it. Any other bearer — the target themselves, another admin,
    // no admin at all — is rejected loudly rather than silently ignored.
    const view = this.viewAsService.verify(viewToken);
    if (user.role !== 'ADMIN' || view.adminId !== user.id) {
      throw new UnauthorizedException({ message: 'Invalid view session', code: 'VIEW_AS_INVALID' });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: view.targetUserId },
      select: { id: true, email: true, role: true, name: true },
    });
    // Deactivated targets stay viewable (support cases) — but a target that
    // was deleted or promoted to ADMIN since the token was minted is not.
    if (!target || target.role === 'ADMIN') {
      throw new UnauthorizedException({ message: 'Invalid view session', code: 'VIEW_AS_INVALID' });
    }

    // Note: the view-mode AsyncLocalStorage context is established by
    // ViewAsReadonlyMiddleware (middleware wraps the downstream chain; a store
    // entered here inside Passport's callback would not propagate out).
    return {
      userId: target.id,
      email: target.email,
      role: target.role,
      viewAs: {
        realAdminId: user.id,
        realAdminEmail: user.email,
        targetUserId: target.id,
        targetName: target.name,
        expiresAt: (view.exp || 0) * 1000,
      },
    };
  }
}
