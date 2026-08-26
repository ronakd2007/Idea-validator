import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SurveyAnalyticsService } from './survey-analytics.service';

/**
 * Unauthenticated by design — anyone holding the share link can read the
 * survey's results. Every payload here is an explicit whitelist assembled in
 * SurveyAnalyticsService, gated by the founder's share settings, and stripped
 * of respondent identities. Kept separate from `public/surveys` (the
 * response-collection routes) so the two links can be revoked independently.
 */
@Controller('public/survey-reports')
export class PublicSurveyReportController {
  constructor(private analytics: SurveyAnalyticsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':shareId')
  getReport(
    @Param('shareId') shareId: string,
    @Query('range') range?: string,
    @Query('outcomeQuestionId') outcomeQuestionId?: string,
    @Query('segmentQuestionId') segmentQuestionId?: string,
  ) {
    return this.analytics.getPublicReport(shareId, { range, outcomeQuestionId, segmentQuestionId });
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':shareId/questions')
  getQuestions(@Param('shareId') shareId: string) {
    return this.analytics.getPublicQuestions(shareId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':shareId/responses')
  getResponses(
    @Param('shareId') shareId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('quality') quality?: string,
    @Query('search') search?: string,
    @Query('questionId') questionId?: string,
  ) {
    return this.analytics.getPublicResponses(shareId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      quality,
      search,
      questionId,
    });
  }
}
