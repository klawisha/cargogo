import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';
import { PayoutAccountModule } from '../payout-accounts/payout-account.module';
import { VerificationModule } from '../verification/verification.module';
@Module({imports:[AuthModule,NotificationModule,PayoutAccountModule,VerificationModule],controllers:[OfferController],providers:[OfferService],exports:[OfferService]})
export class OfferModule{}
