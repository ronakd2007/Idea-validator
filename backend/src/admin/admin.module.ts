import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminActivityController } from './admin-activity.controller';
import { AdminStartupsController } from './admin-startups.controller';
import { AdminService } from './admin.service';
import { IdeasModule } from '../ideas/ideas.module';
import { SurveyModule } from '../survey/survey.module';
import { AuthModule } from '../auth/auth.module';
import { StartupsModule } from '../startups/startups.module';

@Module({
  // Imported so the admin inspection routes can reuse the existing idea
  // dashboard and survey analytics services rather than duplicating them.
  // AuthModule provides ViewAsService for the View-as-User endpoints;
  // StartupsModule provides the same status-transition logic the founder side
  // uses, so review actions can't diverge from it.
  imports: [IdeasModule, SurveyModule, AuthModule, StartupsModule],
  controllers: [AdminController, AdminActivityController, AdminStartupsController],
  providers: [AdminService],
})
export class AdminModule {}
