import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IdeasService } from './ideas.service';

@Controller('ideas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IdeasController {
  constructor(private ideasService: IdeasService) {}

  @Post()
  @Roles('FOUNDER')
  create(@Request() req, @Body() body: any) {
    return this.ideasService.create(req.user.userId, body);
  }

  @Get()
  @Roles('VALIDATOR', 'ADMIN')
  findAll() {
    return this.ideasService.findAllForValidator();
  }

  @Get('my')
  @Roles('FOUNDER')
  findMyIdeas(@Request() req) {
    return this.ideasService.findMyIdeas(req.user.userId);
  }

  @Get(':id/dashboard')
  @Roles('FOUNDER')
  getDashboard(@Param('id') id: string, @Request() req) {
    return this.ideasService.getDashboard(id, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ideasService.findOne(id);
  }

  @Post(':id/revise')
  @Roles('FOUNDER')
  createRevision(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.ideasService.createRevision(id, req.user.userId, body);
  }
}
