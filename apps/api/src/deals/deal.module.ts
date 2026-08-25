import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchingModule } from '../matching/matching.module';
import { NotificationModule } from '../notifications/notification.module';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { PayoutAccountModule } from '../payout-accounts/payout-account.module';
import { SettlementModule } from '../settlement/settlement.module';
import { EconomicsModule } from '../economics/economics.module';
import { VerificationModule } from '../verification/verification.module';
@Module({imports:[AuthModule,MatchingModule,NotificationModule,PayoutAccountModule,SettlementModule,EconomicsModule,VerificationModule],controllers:[DealController],providers:[DealService],exports:[DealService]})
export class DealModule{}
