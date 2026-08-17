import { Module } from '@nestjs/common';
import { StartupsController } from './startups.controller';
import { PublicStartupsController } from './public-startups.controller';
import { StartupsService } from './startups.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IdeasModule } from '../ideas/ideas.module';

@Module({
  // IdeasModule provides the existing scoring logic, so a startup's validation
  // numbers are the same ones the founder's own dashboard shows.
  imports: [PrismaModule, IdeasModule],
  controllers: [StartupsController, PublicStartupsController],
  providers: [StartupsService],
  // Exported so AdminModule can reuse the same service for review actions
  // instead of reimplementing status transitions.
  exports: [StartupsService],
})
export class StartupsModule {}
