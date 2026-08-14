import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IdeasService } from './ideas.service';
import { CreateIdeaDto, UpdateAssumptionsDto } from './dto/idea.dto';

@Controller('ideas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IdeasController {
  constructor(private ideasService: IdeasService) {}

  @Post()
  @Roles('FOUNDER')
  create(@Request() req, @Body() body: CreateIdeaDto) {
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

  // Declared before ':id' so 'versions'/'share' path segments are never
  // captured as an idea id by the catch-all route below.
  @Get(':id/versions')
  @Roles('FOUNDER')
  getVersions(@Param('id') id: string, @Request() req) {
    return this.ideasService.getVersions(id, req.user.userId);
  }

  // Percentile position among all validated ideas on the platform —
  // aggregates only, no other founder's idea is ever identified.
  @Get(':id/benchmark')
  @Roles('FOUNDER')
  getBenchmark(@Param('id') id: string, @Request() req) {
    return this.ideasService.getBenchmark(id, req.user.userId);
  }

  // Assumption Checker: replace the founder's hypothesis list. Private to the
  // founder — never exposed on the public validation page.
  @Patch(':id/assumptions')
  @Roles('FOUNDER')
  updateAssumptions(@Param('id') id: string, @Request() req, @Body() body: UpdateAssumptionsDto) {
    return this.ideasService.updateAssumptions(id, req.user.userId, body.assumptions);
  }

  @Post(':id/share')
  @Roles('FOUNDER')
  enableShare(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.ideasService.enableShare(id, req.user.userId, body?.settings);
  }

  @Patch(':id/share')
  @Roles('FOUNDER')
  updateShareSettings(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.ideasService.updateShareSettings(id, req.user.userId, body?.settings ?? body);
  }

  @Delete(':id/share')
  @Roles('FOUNDER')
  disableShare(@Param('id') id: string, @Request() req) {
    return this.ideasService.disableShare(id, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ideasService.findOne(id, req.user);
  }

  @Post(':id/revise')
  @Roles('FOUNDER')
  createRevision(@Param('id') id: string, @Request() req, @Body() body: CreateIdeaDto) {
    return this.ideasService.createRevision(id, req.user.userId, body);
  }

  // The validation PDF is generated in the browser from data already loaded on
  // the dashboard; this only records that the founder generated it.
  @Post(':id/report-downloaded')
  @Roles('FOUNDER')
  recordReportDownload(@Param('id') id: string, @Request() req) {
    return this.ideasService.recordReportDownload(id, req.user.userId);
  }
}
