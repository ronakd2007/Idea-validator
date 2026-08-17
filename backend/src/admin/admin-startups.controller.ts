import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StartupsService } from '../startups/startups.service';
import { ReviewStartupDto } from '../startups/dto/startup.dto';

// Startup Directory review queue. Its own controller (like AdminActivityController)
// so the already-large AdminController doesn't keep growing. Private admin notes
// are only ever returned from here, behind the ADMIN role guard.
@Controller('admin/startups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStartupsController {
  constructor(private startupsService: StartupsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.startupsService.adminList(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.startupsService.adminDetail(id);
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewStartupDto) {
    return this.startupsService.review(id, dto);
  }
}
