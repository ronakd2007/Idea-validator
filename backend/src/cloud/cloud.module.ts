import { Module } from '@nestjs/common';
import { CloudController } from './cloud.controller';
import { CloudPushService } from './cloud-push.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CloudController],
  providers: [CloudPushService],
})
export class CloudModule {}
