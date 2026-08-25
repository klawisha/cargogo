import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FeeSnapshot = {
  agreedAmountMinor: number;
  platformFeeMinor: number;
  carrierAmountMinor: number;
  targetNetMarginMinor: number;
  estimatedAcquiringFeeMinor: number;
  estimatedPayoutFeeMinor: number;
  policy: {
    version: 1;
    targetNetMarginBps: number;
    acquiringFeeEstimateBps: number;
    payoutFeeEstimateBps: number;
    minMarketplaceFeeMinor: number;
    rounding: 'half_up';
  };
};

@Injectable()
export class EconomicsService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  snapshot(amountMinorInput: number): FeeSnapshot {
    const amountMinor = this.requireMinor(amountMinorInput, 'amount');
    const targetBps = this.config.getOrThrow<number>('TARGET_NET_MARGIN_BPS');
    const acquiringBps = this.config.getOrThrow<number>('ACQUIRING_FEE_ESTIMATE_BPS');
    const payoutBps = this.config.getOrThrow<number>('PAYOUT_FEE_ESTIMATE_BPS');
    const minFee = this.config.getOrThrow<number>('MIN_MARKETPLACE_FEE_MINOR');

    const targetNetMarginMinor = this.bps(amountMinor, targetBps);
    const estimatedAcquiringFeeMinor = this.bps(amountMinor, acquiringBps);
    // Conservative estimate: payout cost is estimated against gross deal amount.
    // Actual payout fee is recorded later from the payout provider response.
    const estimatedPayoutFeeMinor = this.bps(amountMinor, payoutBps);
    const variableFee = targetNetMarginMinor + estimatedAcquiringFeeMinor + estimatedPayoutFeeMinor;
    const platformFeeMinor = Math.max(minFee, variableFee);
    const carrierAmountMinor = amountMinor - platformFeeMinor;

    if (platformFeeMinor >= amountMinor || carrierAmountMinor <= 0) {
      throw new ConflictException({ code: 'FEE_CONFIGURATION_INVALID', message: 'Marketplace fee leaves no carrier payout' });
    }

    return {
      agreedAmountMinor: amountMinor,
      platformFeeMinor,
      carrierAmountMinor,
      targetNetMarginMinor,
      estimatedAcquiringFeeMinor,
      estimatedPayoutFeeMinor,
      policy: {
        version: 1,
        targetNetMarginBps: targetBps,
        acquiringFeeEstimateBps: acquiringBps,
        payoutFeeEstimateBps: payoutBps,
        minMarketplaceFeeMinor: minFee,
        rounding: 'half_up',
      },
    };
  }

  sandboxPayoutFee(amountMinorInput: number): number {
    return this.bps(this.requireMinor(amountMinorInput, 'payout amount'), this.config.getOrThrow<number>('PAYOUT_SANDBOX_ACTUAL_FEE_BPS'));
  }

  providerMoneyToMinor(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return Math.round(numeric * 100);
  }

  netRevenue(platformFeeMinorInput: number, acquiringFeeMinorInput: number, payoutFeeMinorInput: number) {
    const platformFeeMinor = this.requireMinor(platformFeeMinorInput, 'platform fee', true);
    const acquiringFeeMinor = this.requireMinor(acquiringFeeMinorInput, 'acquiring fee', true);
    const payoutFeeMinor = this.requireMinor(payoutFeeMinorInput, 'payout fee', true);
    return platformFeeMinor - acquiringFeeMinor - payoutFeeMinor;
  }

  marginBps(netRevenueMinor: number, agreedAmountMinor: number): number {
    if (!Number.isSafeInteger(netRevenueMinor) || !Number.isSafeInteger(agreedAmountMinor) || agreedAmountMinor <= 0) return 0;
    return Number((BigInt(netRevenueMinor) * 10_000n) / BigInt(agreedAmountMinor));
  }

  private bps(amountMinor: number, bps: number): number {
    if (!Number.isSafeInteger(bps) || bps < 0) throw new Error('Invalid basis points configuration');
    // Integer-only half-up rounding. No floating point money calculations.
    return Number((BigInt(amountMinor) * BigInt(bps) + 5_000n) / 10_000n);
  }

  private requireMinor(value: number, label: string, allowZero = false) {
    if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) throw new Error(`Invalid ${label} minor amount`);
    return value;
  }
}
