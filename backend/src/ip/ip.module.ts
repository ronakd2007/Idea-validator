import { Module } from '@nestjs/common';
import { IpController } from './ip.controller';
import { PublicIpController } from './public-ip.controller';
import { IpService } from './ip.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IpController, PublicIpController],
  providers: [IpService],
  // Exported so AdminModule can reuse the same service for the review queue
  // and ecosystem analytics instead of reimplementing the status transitions.
  exports: [IpService],
})
export class IpModule {}
