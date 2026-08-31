import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IpService } from './ip.service';

// Unauthenticated by design — this is the public Innovation & Patent Registry.
// Both methods filter on visibility PUBLIC *and* reviewStatus APPROVED at the
// database level, so a private, pending or rejected record cannot be reached
// even by guessing its id. Payloads are built by toPublicIpRecord, which never
// spreads the row.
@Controller('public/ip')
export class PublicIpController {
  constructor(private ipService: IpService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  list(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('state') state?: string,
    @Query('industry') industry?: string,
    @Query('q') q?: string
  ) {
    return this.ipService.publicList({ type, status, state, industry, q });
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.ipService.publicDetail(id);
  }
}
