import { Module } from '@nestjs/common';
import { SurveyController } from './survey.controller';
import { SurveyService } from './survey.service';
import { PublicSurveyController } from './public-survey.controller';
import { PublicSurveyService } from './public-survey.service';
import { SurveyAnalyticsService } from './survey-analytics.service';

@Module({
  controllers: [SurveyController, PublicSurveyController],
  providers: [SurveyService, PublicSurveyService, SurveyAnalyticsService],
})
export class SurveyModule {}
