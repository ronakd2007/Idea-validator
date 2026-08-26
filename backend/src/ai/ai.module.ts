import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SurveyModule } from '../survey/survey.module';

@Module({
  // SurveyModule provides SurveyAnalyticsService, so AI recommendations can
  // cite the founder's actual survey numbers instead of generic advice.
  imports: [PrismaModule, SurveyModule],
  controllers: [AiController],
  providers: [AiService, AgentService],
  // PaymentModule starts an AI Deep Dive when an idea is paid for. Only the
  // agent is exported — it reads ideas through Prisma directly, so IdeasModule
  // never has to be imported back here.
  exports: [AgentService],
})
export class AiModule {}
