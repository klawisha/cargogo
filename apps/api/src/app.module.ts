import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import path from 'node:path';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CargoModule } from './cargo/cargo.module';
import { VehicleModule } from './vehicles/vehicle.module';
import { TripModule } from './trips/trip.module';
import { OfferModule } from './offers/offer.module';
import { DealModule } from './deals/deal.module';
import { ChatModule } from './chats/chat.module';
import { LocationModule } from './locations/location.module';
import { DisputeModule } from './disputes/dispute.module';
import { VerificationModule } from './verification/verification.module';
import { NotificationModule } from './notifications/notification.module';
import { PaymentModule } from './payments/payment.module';
import { PayoutAccountModule } from './payout-accounts/payout-account.module';
import { SettlementModule } from './settlement/settlement.module';
import { EconomicsModule } from './economics/economics.module';
import { StaffModule } from './staff/staff.module';
import { LiveModule } from './live/live.module';
import { CarrierModeModule } from './carrier-mode/carrier-mode.module';
import { LegalModule } from './legal/legal.module';
import { OpsModule } from './ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, cache: true,
      envFilePath: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule, HealthModule, AuthModule, LegalModule, OpsModule, UsersModule, CarrierModeModule, LocationModule, NotificationModule, VerificationModule, DisputeModule, CargoModule, VehicleModule, TripModule, OfferModule, DealModule, PayoutAccountModule, EconomicsModule, SettlementModule, PaymentModule, ChatModule, StaffModule, LiveModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
