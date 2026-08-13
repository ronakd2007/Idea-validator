import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ViewAsReadonlyMiddleware } from './auth/view-as-readonly.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { ActivityModule } from './activity/activity.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IdeasModule } from './ideas/ideas.module';
import { ValidationModule } from './validation/validation.module';
import { PaymentModule } from './payment/payment.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { SurveyModule } from './survey/survey.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline abuse protection for every route; sensitive endpoints (OTP,
    // login, registration, public survey writes) declare stricter @Throttle
    // limits on their own handlers.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    ActivityModule,
    AuthModule,
    UsersModule,
    IdeasModule,
    ValidationModule,
    PaymentModule,
    AdminModule,
    AiModule,
    SurveyModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // View as User is strictly read-only: any mutating request carrying the
    // X-View-As header is refused before it reaches guards or handlers.
    consumer.apply(ViewAsReadonlyMiddleware).forRoutes('*');
  }
}
