/**
 * Tiny TTL cache for the per-request user lookup in JwtStrategy.
 *
 * The strategy re-reads the user from the database on every request so that
 * deactivation and role changes take effect immediately. That safety check
 * costs a full database round trip per request — expensive when the API and
 * the database live in different regions. Caching for a short window keeps
 * ~98% of the security property at ~2% of the cost.
 *
 * Admin actions that MUST bite instantly (deactivating a user) call
 * invalidateUser() explicitly, so the 60s window never applies to them —
 * this process is a single instance, so in-memory invalidation is complete.
 */

export interface CachedUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000; // hard cap so the cache can never grow unbounded

const cache = new Map<string, { user: CachedUser; expires: number }>();

export function getCachedUser(id: string): CachedUser | null {
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(id);
    return null;
  }
  return hit.user;
}

export function setCachedUser(user: CachedUser): void {
  if (cache.size >= MAX_ENTRIES) {
    // Drop the oldest entry (Map preserves insertion order) — simple, O(1),
    // and good enough for a cache this small.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(user.id, { user, expires: Date.now() + TTL_MS });
}

export function invalidateUser(id: string): void {
  cache.delete(id);
}
