import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminActivityController } from './admin-activity.controller';
import { AdminService } from './admin.service';
import { IdeasModule } from '../ideas/ideas.module';
import { SurveyModule } from '../survey/survey.module';

@Module({
  // Imported so the admin inspection routes can reuse the existing idea
  // dashboard and survey analytics services rather than duplicating them.
  imports: [IdeasModule, SurveyModule],
  controllers: [AdminController, AdminActivityController],
  providers: [AdminService],
})
export class AdminModule {}
