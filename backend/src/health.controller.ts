import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

const STARTED_AT = new Date().toISOString();

/**
 * Public build/liveness probe. Exists because "is my fix actually deployed?"
 * was previously unanswerable from outside — a stale server and a broken
 * feature look identical from the browser. Render injects RENDER_GIT_COMMIT
 * at build time, so this reports exactly which commit is serving traffic.
 *
 * Deliberately exposes nothing sensitive: a commit SHA, the process start
 * time, and a status string.
 */
@Controller('health')
export class HealthController {
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  get() {
    const commit = process.env.RENDER_GIT_COMMIT || null;
    return {
      status: 'ok',
      commit: commit ? commit.slice(0, 7) : 'local',
      startedAt: STARTED_AT,
    };
  }
}
