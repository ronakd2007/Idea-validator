import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';

// Global (like PrismaModule) so any service can record an activity without
// every feature module having to import this one — and without creating
// circular module dependencies between auth/ideas/survey/validation.
@Global()
@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
