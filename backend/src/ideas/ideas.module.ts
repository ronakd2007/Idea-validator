import { Module } from '@nestjs/common';
import { IdeasController } from './ideas.controller';
import { PublicIdeasController } from './public-ideas.controller';
import { IdeasService } from './ideas.service';
import { SurveyModule } from '../survey/survey.module';

@Module({
  // SurveyModule gives access to SurveyAnalyticsService, so the public idea
  // page reports customer-survey evidence with the same numbers the founder's
  // own analytics page shows.
  imports: [SurveyModule],
  controllers: [IdeasController, PublicIdeasController],
  providers: [IdeasService],
  exports: [IdeasService],
})
export class IdeasModule {}
