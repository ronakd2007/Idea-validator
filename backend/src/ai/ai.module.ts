import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SurveyModule } from '../survey/survey.module';

@Module({
  // SurveyModule provides SurveyAnalyticsService, so AI recommendations can
  // cite the founder's actual survey numbers instead of generic advice.
  imports: [PrismaModule, SurveyModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
