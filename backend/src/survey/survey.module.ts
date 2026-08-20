import { Module } from '@nestjs/common';
import { SurveyController } from './survey.controller';
import { SurveyService } from './survey.service';
import { PublicSurveyController } from './public-survey.controller';
import { PublicSurveyService } from './public-survey.service';
import { SurveyAnalyticsService } from './survey-analytics.service';
import { PublicSurveyReportController } from './public-survey-report.controller';

@Module({
  controllers: [SurveyController, PublicSurveyController, PublicSurveyReportController],
  providers: [SurveyService, PublicSurveyService, SurveyAnalyticsService],
  // Exported so the admin module can reuse the existing response viewer and
  // analytics instead of reimplementing them.
  exports: [SurveyAnalyticsService],
})
export class SurveyModule {}
