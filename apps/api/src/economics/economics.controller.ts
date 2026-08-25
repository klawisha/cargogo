import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EconomicsService } from './economics.service';

@Controller('economics')
@UseGuards(AuthGuard)
export class EconomicsController {
  constructor(private readonly economics: EconomicsService) {}

  @Get('quote')
  quote(@Query('amountMinor') raw?: string) {
    const amountMinor = Number(raw);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'amountMinor must be a positive integer' });
    }
    const snapshot = this.economics.snapshot(amountMinor);
    return {
      amountMinor: snapshot.agreedAmountMinor,
      marketplaceFeeMinor: snapshot.platformFeeMinor,
      carrierAmountMinor: snapshot.carrierAmountMinor,
      targetNetMarginMinor: snapshot.targetNetMarginMinor,
      estimatedAcquiringFeeMinor: snapshot.estimatedAcquiringFeeMinor,
      estimatedPayoutFeeMinor: snapshot.estimatedPayoutFeeMinor,
      policy: snapshot.policy,
    };
  }
}
