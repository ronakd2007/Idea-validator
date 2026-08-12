import { Controller, Get, Param, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ActivityService, ACTION_CATALOG, ACTIVITY_CATEGORIES, ACTOR_ROLES } from '../activity/activity.service';
import { AdminService } from './admin.service';
import { IdeasService } from '../ideas/ideas.service';
import { SurveyAnalyticsService } from '../survey/survey-analytics.service';

/**
 * Admin activity feed and data inspection.
 *
 * Every route here is behind JwtAuthGuard + RolesGuard with @Roles('ADMIN') at
 * the class level, so authorization is enforced server-side and does not depend
 * on the frontend hiding a link. The survey/idea reads deliberately reuse the
 * existing founder-facing services rather than reimplementing them.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminActivityController {
  constructor(
    private activity: ActivityService,
    private adminService: AdminService,
    private ideasService: IdeasService,
    private surveyAnalytics: SurveyAnalyticsService
  ) {}

  // ---------- activity ----------

  // Declared before ':id' so "summary"/"filters" are never captured as an id.
  @Get('activity/summary')
  getSummary() {
    return this.activity.getSummary();
  }

  @Get('activity/filters')
  getFilterOptions() {
    return {
      roles: ACTOR_ROLES,
      categories: ACTIVITY_CATEGORIES,
      actions: Object.entries(ACTION_CATALOG).map(([action, meta]) => ({
        action,
        label: meta.label,
        category: meta.category,
      })),
    };
  }

  @Get('activity')
  getFeed(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.activity.getFeed({
      search,
      role,
      category,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('activity/:id')
  async getActivityDetail(@Param('id') id: string) {
    const detail = await this.activity.getDetail(id);
    if (!detail) throw new NotFoundException('Activity not found');
    return detail;
  }

  // ---------- user inspection ----------

  @Get('users/:id/overview')
  getUserOverview(@Param('id') id: string) {
    return this.adminService.getUserOverview(id);
  }

  @Get('users/:id/activity')
  getUserActivity(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.activity.getForUser(id, limit ? Number(limit) : undefined);
  }

  // ---------- idea inspection ----------

  // Same payload the founder's own dashboard uses — validator scores, feedback,
  // risk assessment and aggregates — so the admin page can reuse the existing
  // components and the existing client-side PDF generator unchanged.
  @Get('ideas/:id/dashboard')
  getIdeaDashboard(@Param('id') id: string) {
    return this.ideasService.getDashboardForAdmin(id);
  }

  @Get('ideas/:id/activity')
  getIdeaActivity(@Param('id') id: string) {
    return this.activity.getForTarget('IDEA', id);
  }

  // ---------- survey inspection ----------

  @Get('surveys/:id/detail')
  getSurveyDetail(@Param('id') id: string) {
    return this.adminService.getSurveyDetail(id);
  }

  // Reuses the founder response viewer: same pagination, same search, same
  // quality flags. `null` selects the admin path on the ownership check.
  @Get('surveys/:id/responses')
  getSurveyResponses(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('quality') quality?: string,
    @Query('search') search?: string,
    @Query('questionId') questionId?: string
  ) {
    return this.surveyAnalytics.getResponsesPage(id, null, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      quality,
      search,
      questionId,
    });
  }

  @Get('surveys/:id/analytics')
  getSurveyAnalytics(
    @Param('id') id: string,
    @Query('range') range?: string,
    @Query('outcomeQuestionId') outcomeQuestionId?: string,
    @Query('segmentQuestionId') segmentQuestionId?: string
  ) {
    return this.surveyAnalytics.getAnalytics(id, null, { range, outcomeQuestionId, segmentQuestionId });
  }

  @Get('surveys/:id/activity')
  getSurveyActivity(@Param('id') id: string) {
    return this.activity.getForTarget('SURVEY', id);
  }
}
