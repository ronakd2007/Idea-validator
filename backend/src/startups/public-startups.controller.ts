import { Controller, Get, Param, Query } from '@nestjs/common';
import { StartupsService } from './startups.service';

// Unauthenticated by design — this is the public directory. Both methods
// return whitelist-built payloads and filter on status APPROVED at the
// database level, so an unapproved listing cannot be reached even by
// guessing its slug.
@Controller('public/startups')
export class PublicStartupsController {
  constructor(private startupsService: StartupsService) {}

  @Get()
  list(
    @Query('industry') industry?: string,
    @Query('location') location?: string,
    @Query('stage') stage?: string,
    @Query('lookingFor') lookingFor?: string
  ) {
    return this.startupsService.publicList({ industry, location, stage, lookingFor });
  }

  @Get(':slug')
  profile(@Param('slug') slug: string) {
    return this.startupsService.publicProfile(slug);
  }
}
