import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ContextBuilderService } from './context-builder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IdeasModule } from '../ideas/ideas.module';
import { SurveyModule } from '../survey/survey.module';

@Module({
  // IdeasModule/SurveyModule provide the exact same services the report
  // pages call, so the assistant's context always matches what the founder
  // sees on screen — no parallel data-fetching logic to drift out of sync.
  imports: [PrismaModule, IdeasModule, SurveyModule],
  controllers: [ChatController],
  providers: [ChatService, ContextBuilderService],
})
export class ChatModule {}
