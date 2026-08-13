import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Get('config')
  getConfig() {
    return this.paymentService.getConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FOUNDER')
  @Post('mock/:ideaId')
  mockPayment(@Param('ideaId') ideaId: string, @Request() req) {
    return this.paymentService.mockPayment(ideaId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FOUNDER')
  @Get('history')
  getHistory(@Request() req) {
    return this.paymentService.getPaymentHistory(req.user.userId);
  }
}
