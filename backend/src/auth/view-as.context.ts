import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request marker that the current request is an admin *viewing* another
 * user, not the user themselves. Entered by JwtStrategy when a valid
 * X-View-As token substitutes the effective identity.
 *
 * Services read it to stay side-effect-free in view mode — most importantly
 * ActivityService, which must never write feed events in the viewed user's
 * name for pages the admin merely looked at.
 */
export const viewAsContext = new AsyncLocalStorage<{ realAdminId: string }>();

export function isViewAsRequest(): boolean {
  return !!viewAsContext.getStore();
}
