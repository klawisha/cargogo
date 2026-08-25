import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealModule } from '../deals/deal.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [AuthModule, DealModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
