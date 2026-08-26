import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AiModule } from '../ai/ai.module';

@Module({
  // AiModule provides AgentService: a completed payment is what starts the
  // idea's AI Deep Dive.
  imports: [AiModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
