import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class PaymentService {
  private fee: number;

  constructor(private config: ConfigService, private prisma: PrismaService, private activity: ActivityService) {
    this.fee = Number(config.get('IDEA_SUBMISSION_FEE', 999));
  }

  // Payment completing is the moment an idea actually goes live for validators,
  // so that is what gets recorded as "submitted".
  private async logIdeaSubmitted(ideaId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      select: { id: true, title: true, founderId: true, version: true, founder: { select: { name: true, role: true } } },
    });
    if (!idea) return;

    void this.activity.log({
      userId: idea.founderId,
      actorRole: idea.founder?.role || 'FOUNDER',
      actorLabel: idea.founder?.name || 'Unknown user',
      action: 'IDEA_SUBMITTED',
      targetType: 'IDEA',
      targetId: idea.id,
      targetLabel: idea.title,
      ownerUserId: idea.founderId,
      metadata: { ideaId: idea.id, version: idea.version },
    });
  }

  getConfig() {
    return {
      stripePublicKey: this.config.get('STRIPE_PUBLIC_KEY', ''),
      razorpayKeyId: this.config.get('RAZORPAY_KEY_ID', ''),
      fee: this.fee,
    };
  }

  async mockPayment(ideaId: string, founderId: string) {
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.founderId !== founderId) throw new BadRequestException('Access denied');

    const amount = idea.isRevision ? Math.round(this.fee * 0.4) : this.fee;

    await this.prisma.payment.create({
      data: {
        ideaId,
        founderId,
        amount,
        currency: 'USD',
        gateway: 'MOCK',
        gatewayPaymentId: `mock_${Date.now()}`,
        status: 'COMPLETED',
      },
    });

    await this.prisma.idea.update({
      where: { id: ideaId },
      data: { paymentStatus: 'COMPLETED' },
    });

    await this.logIdeaSubmitted(ideaId);

    return { success: true, amount, message: 'Payment completed (test mode)' };
  }

  async getPaymentHistory(founderId: string) {
    return this.prisma.payment.findMany({
      where: { founderId },
      include: { idea: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyRazorpay(body: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    ideaId: string;
  }) {
    const sign = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', this.config.get('RAZORPAY_KEY_SECRET', ''))
      .update(sign)
      .digest('hex');

    if (expected !== body.razorpay_signature) throw new BadRequestException('Invalid signature');

    await this.prisma.payment.updateMany({
      where: { gatewayPaymentId: body.razorpay_order_id },
      data: { status: 'COMPLETED' },
    });

    await this.prisma.idea.update({
      where: { id: body.ideaId },
      data: { paymentStatus: 'COMPLETED' },
    });

    await this.logIdeaSubmitted(body.ideaId);

    return { success: true };
  }
}
