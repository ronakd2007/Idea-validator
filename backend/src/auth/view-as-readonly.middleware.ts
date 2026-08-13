import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { viewAsContext } from './view-as.context';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Default-deny write protection for View as User mode. Runs before guards on
 * EVERY route — including unauthenticated ones like the public survey
 * endpoints — so no write slips through an endpoint nobody thought about.
 *
 * The mere presence of the X-View-As header on a mutating request is enough
 * to refuse it: a client in view mode has no business writing, valid token or
 * not. Admin-portal routes are exempt because identity substitution never
 * applies there (the admin acts as themselves, e.g. to end the view session).
 *
 * For view-mode GETs, the rest of the request is wrapped in viewAsContext so
 * side-effectful reads stay silent (ActivityService skips logging). It must
 * happen HERE, in middleware, because middleware wraps the downstream chain —
 * an AsyncLocalStorage store entered inside Passport's validate callback does
 * not propagate back out to the controller. If the header turns out to be
 * invalid, JwtStrategy rejects the request before any service runs, so
 * wrapping unauthenticated-but-headered requests is safe.
 */
@Injectable()
export class ViewAsReadonlyMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    const hasViewHeader = !!req.headers?.['x-view-as'];
    const path: string = req.originalUrl || req.url || '';
    if (!hasViewHeader || path.startsWith('/api/admin')) return next();

    if (!SAFE_METHODS.has(req.method)) {
      throw new ForbiddenException('This action is disabled while viewing as another user.');
    }
    viewAsContext.run({ realAdminId: 'pending-verification' }, () => next());
  }
}
