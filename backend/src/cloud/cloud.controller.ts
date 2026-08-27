import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CloudPushService } from './cloud-push.service';

@Controller('cloud')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CloudController {
  constructor(private readonly cloudPush: CloudPushService) {}

  /**
   * Whether this server can push at all. The dashboard asks first so the
   * button only appears where it would actually work — on the deployed site
   * CLOUD_DATABASE_URL is unset, so this reports false and nothing renders.
   */
  @Get('status')
  @Roles('FOUNDER')
  status() {
    return { enabled: CloudPushService.isConfigured(), target: CloudPushService.targetLabel() };
  }

  // Each push writes to a live database, so it is rate limited well below
  // anything a person would hit by clicking.
  @Post('push/:ideaId')
  @Roles('FOUNDER')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  push(@Param('ideaId') ideaId: string, @Request() req: any) {
    // View-as admins are already blocked from any non-GET by middleware, so a
    // push can only ever be the founder acting on their own idea.
    return this.cloudPush.pushIdea(ideaId, req.user.userId);
  }
}
