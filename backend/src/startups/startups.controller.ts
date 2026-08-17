import { Controller, Get, Put, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StartupsService } from './startups.service';
import { UpsertStartupDto } from './dto/startup.dto';

// Founder-facing listing management. Ownership and the "idea must be validated"
// gate are both enforced inside the service; the global view-as middleware
// blocks the PUT while an admin is viewing as this founder.
@Controller('startups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FOUNDER')
export class StartupsController {
  constructor(private startupsService: StartupsService) {}

  @Get('idea/:ideaId')
  getForIdea(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.startupsService.getForIdea(ideaId, req.user.userId);
  }

  @Put('idea/:ideaId')
  upsertForIdea(@Param('ideaId') ideaId: string, @Body() dto: UpsertStartupDto, @Request() req: any) {
    return this.startupsService.upsertForIdea(ideaId, req.user.userId, dto);
  }
}
