import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IdeasService } from './ideas.service';

// Unauthenticated by design — anyone with the share link can view the idea's
// public validation card. The payload is an explicit whitelist assembled in
// IdeasService.getPublicIdea, gated by the founder's share settings.
@Controller('public/ideas')
export class PublicIdeasController {
  constructor(private ideasService: IdeasService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':publicId')
  getPublic(@Param('publicId') publicId: string) {
    return this.ideasService.getPublicIdea(publicId);
  }
}
