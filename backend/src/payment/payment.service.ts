import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { AgentService } from '../ai/agent.service';

@Injectable()
export class PaymentService {
  private fee: number;
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private activity: ActivityService,
    private agent: AgentService,
  ) {
    this.fee = Number(config.get('IDEA_SUBMISSION_FEE', 2999));
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

    // Payment completing is also when AI Deep Dive research becomes worth
    // paying for in search credits and model calls, so it starts here rather
    // than at idea creation — an abandoned draft never spends anything. This
    // covers revisions too: they reach COMPLETED through this same method.
    // Fire-and-forget by design; research failing must never fail a payment.
    void this.agent
      .startRun(ideaId, founderId, 'auto')
      .catch(err => this.logger.error(`Could not start AI Deep Dive for idea ${ideaId}: ${err?.message}`));

    return { success: true, amount, message: 'Payment completed (test mode)' };
  }

  async getPaymentHistory(founderId: string) {
    return this.prisma.payment.findMany({
      where: { founderId },
      include: { idea: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // The Razorpay verify endpoint was removed deliberately: no order-creation
  // endpoint ever existed (so no Payment row could match), the frontend never
  // called it, and with RAZORPAY_KEY_SECRET unset its HMAC check was forgeable
  // with an empty key — letting anyone mark any idea as paid. Reintroduce it
  // only together with a server-side create-order flow and an ownership check.
}
