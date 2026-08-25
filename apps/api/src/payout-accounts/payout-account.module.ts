import { Module } from '@nestjs/common';import { AuthModule } from '../auth/auth.module';import { PayoutAccountController } from './payout-account.controller';import { PayoutAccountService } from './payout-account.service';
@Module({imports:[AuthModule],controllers:[PayoutAccountController],providers:[PayoutAccountService],exports:[PayoutAccountService]}) export class PayoutAccountModule{}
