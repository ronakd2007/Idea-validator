import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Header, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SurveyService } from './survey.service';
import { SurveyAnalyticsService } from './survey-analytics.service';

@Controller('surveys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SurveyController {
  constructor(
    private surveyService: SurveyService,
    private surveyAnalyticsService: SurveyAnalyticsService
  ) {}

  @Post()
  @Roles('FOUNDER')
  create(@Request() req, @Body() body: { ideaId?: string; title: string; description?: string }) {
    return this.surveyService.create(req.user.userId, body.ideaId, body.title, body.description || '');
  }

  @Get('my')
  @Roles('FOUNDER')
  findMine(@Request() req) {
    return this.surveyService.findMine(req.user.userId);
  }

  @Get(':id')
  @Roles('FOUNDER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.surveyService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  @Roles('FOUNDER')
  update(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.surveyService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  @Roles('FOUNDER')
  remove(@Param('id') id: string, @Request() req) {
    return this.surveyService.remove(id, req.user.userId);
  }

  @Post(':id/publish')
  @Roles('FOUNDER')
  publish(@Param('id') id: string, @Request() req) {
    return this.surveyService.publish(id, req.user.userId);
  }

  @Post(':id/close')
  @Roles('FOUNDER')
  close(@Param('id') id: string, @Request() req) {
    return this.surveyService.close(id, req.user.userId);
  }

  @Post(':id/reopen')
  @Roles('FOUNDER')
  reopen(@Param('id') id: string, @Request() req) {
    return this.surveyService.reopen(id, req.user.userId);
  }

  @Get(':id/responses')
  @Roles('FOUNDER')
  getResponses(
    @Param('id') id: string,
    @Request() req,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('quality') quality?: string,
    @Query('search') search?: string,
    @Query('questionId') questionId?: string
  ) {
    return this.surveyAnalyticsService.getResponsesPage(id, req.user.userId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      quality,
      search,
      questionId,
    });
  }

  @Get(':id/analytics')
  @Roles('FOUNDER')
  getAnalytics(
    @Param('id') id: string,
    @Request() req,
    @Query('range') range?: string,
    @Query('outcomeQuestionId') outcomeQuestionId?: string,
    @Query('segmentQuestionId') segmentQuestionId?: string
  ) {
    return this.surveyAnalyticsService.getAnalytics(id, req.user.userId, { range, outcomeQuestionId, segmentQuestionId });
  }

  @Get(':id/export')
  @Roles('FOUNDER')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="survey_responses.csv"')
  async exportCsv(@Param('id') id: string, @Request() req) {
    return this.surveyAnalyticsService.exportCsv(id, req.user.userId);
  }

  @Post(':id/versions')
  @Roles('FOUNDER')
  createVersion(@Param('id') id: string, @Request() req) {
    return this.surveyService.createVersion(id, req.user.userId);
  }

  @Get(':id/versions')
  @Roles('FOUNDER')
  getVersions(@Param('id') id: string, @Request() req) {
    return this.surveyService.getVersions(id, req.user.userId);
  }

  @Patch(':id/incentive')
  @Roles('FOUNDER')
  upsertIncentive(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.surveyService.upsertIncentive(id, req.user.userId, body);
  }

  @Delete(':id/incentive')
  @Roles('FOUNDER')
  removeIncentive(@Param('id') id: string, @Request() req) {
    return this.surveyService.removeIncentive(id, req.user.userId);
  }
}
