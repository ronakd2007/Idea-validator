import { Controller, Get, Patch, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IpService } from '../ip/ip.service';
import { ReviewIpRecordDto } from '../ip/dto/ip.dto';

// Innovation & Patent Registry review queue and ecosystem analytics. Its own
// controller (like AdminStartupsController) so the already-large
// AdminController doesn't keep growing. Private admin notes and founder
// contact details are only ever returned from here, behind the ADMIN guard.
@Controller('admin/ip')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminIpController {
  constructor(private ipService: IpService) {}

  // Declared before ':id' — Nest matches in declaration order, and the param
  // route would otherwise swallow "stats" and "analytics".
  @Get('stats')
  stats() {
    return this.ipService.stats();
  }

  @Get('analytics')
  analytics() {
    return this.ipService.analytics();
  }

  @Get()
  list(
    @Query('reviewStatus') reviewStatus?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('jurisdiction') jurisdiction?: string,
    @Query('state') state?: string,
    @Query('institution') institution?: string,
    @Query('visibility') visibility?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string
  ) {
    return this.ipService.adminList({
      reviewStatus, status, type, jurisdiction, state, institution, visibility, from, to, q,
    });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.ipService.adminDetail(id);
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewIpRecordDto, @Request() req: any) {
    return this.ipService.review(id, req.user.userId, dto);
  }
}
