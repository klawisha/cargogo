import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from '../notifications/notification.service';
import { PayoutAccountService } from '../payout-accounts/payout-account.service';
import { EconomicsService } from '../economics/economics.service';

const LIQPAY_API_URL = 'https://www.liqpay.ua/api/request';

type ProviderResult = {
  status?: string;
  payment_id?: string | number;
  liqpay_order_id?: string;
  receiver_commission?: number | string;
  [key: string]: unknown;
};

type CaptureResult = ProviderResult & { acquiringFeeMinor: number };
type PayoutResult = {
  status: 'paid' | 'failed' | 'manual_review';
  reference?: string;
  error?: string;
  feeMinor?: number;
  payload?: Record<string, unknown>;
};

@Injectable()
export class SettlementService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly payoutAccounts: PayoutAccountService,
    private readonly notifications: NotificationService,
    private readonly economics: EconomicsService,
  ) {}

  async settleDeliveredDeal(dealId: string) {
    const prepared = await this.db.transaction(async (client) => {
      const deal = (await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [dealId])).rows[0];
      if (!deal) throw new ConflictException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
      if (deal.status === 'completed') return { done: true as const };
      if (deal.status !== 'delivered') throw new ConflictException({ code: 'SETTLEMENT_STATE_INVALID', message: 'Deal must be delivered before settlement' });
      if (!deal.payout_account_id) throw new ConflictException({ code: 'PAYOUT_ACCOUNT_SNAPSHOT_MISSING', message: 'Deal has no payout account snapshot' });

      const account = (await client.query<any>('SELECT * FROM payout_account WHERE id=$1', [deal.payout_account_id])).rows[0];
      if (!account) throw new ConflictException({ code: 'PAYOUT_ACCOUNT_NOT_FOUND', message: 'Deal payout account no longer exists' });

      const payout = (await client.query<any>(
        `INSERT INTO payout(deal_id,user_id,payout_account_id,amount_minor,currency,provider,status)
         VALUES($1,$2,$3,$4,$5,$6,'queued')
         ON CONFLICT(deal_id) DO UPDATE SET payout_account_id=EXCLUDED.payout_account_id
         RETURNING *`,
        [deal.id, deal.driver_id, account.id, deal.carrier_amount_minor, deal.currency, this.payoutMode()],
      )).rows[0];

      const captureNeeded = deal.payment_status !== 'captured';
      await client.query('UPDATE deal SET settlement_status=$2,updated_at=now() WHERE id=$1', [deal.id, captureNeeded ? 'capture_pending' : 'payout_pending']);
      return { done: false as const, deal, payout, account, captureNeeded };
    });

    if (prepared.done) return;

    const capture = prepared.captureNeeded
      ? await this.capture(prepared.deal)
      : { status: 'already_captured', acquiringFeeMinor: Number(prepared.deal.actual_acquiring_fee_minor ?? prepared.deal.estimated_acquiring_fee_minor ?? 0) };

    if (prepared.captureNeeded) {
      await this.db.transaction(async (client) => {
        const deal = (await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [dealId])).rows[0];
        if (!deal || deal.status === 'completed' || deal.payment_status === 'captured') return;

        await client.query(
          `UPDATE deal SET payment_status='captured',settlement_status='payout_pending',captured_at=COALESCE(captured_at,now()),
             actual_acquiring_fee_minor=$2,updated_at=now() WHERE id=$1`,
          [dealId, capture.acquiringFeeMinor],
        );

        await this.ledger(client, dealId, null, 'customer_capture', deal.agreed_amount_minor, deal.currency, deal.payment_provider, deal.payment_reference, { providerStatus: capture.status });
        await this.ledger(client, dealId, null, 'platform_fee', deal.platform_fee_minor, deal.currency, 'cargogo', null, { kind: 'gross_marketplace_fee' });
        await this.ledger(client, dealId, null, 'carrier_payable', deal.carrier_amount_minor, deal.currency, 'cargogo', null, {});
        await this.ledger(client, dealId, null, 'acquiring_fee', capture.acquiringFeeMinor, deal.currency, deal.payment_provider, deal.payment_reference, { source: this.config.getOrThrow<string>('PAYMENTS_MODE') === 'mock' ? 'configured_estimate' : 'provider_receiver_commission' });

        await client.query(
          `INSERT INTO deal_event(deal_id,actor_user_id,event_type,from_status,to_status,metadata)
           VALUES($1,NULL,'payment.captured','delivered','delivered',$2::jsonb)`,
          [dealId, JSON.stringify({
            amountMinor: Number(deal.agreed_amount_minor),
            platformFeeMinor: Number(deal.platform_fee_minor),
            carrierAmountMinor: Number(deal.carrier_amount_minor),
            acquiringFeeMinor: capture.acquiringFeeMinor,
            providerStatus: capture.status,
          })],
        );
      });
    }

    await this.processPayout(dealId);
  }

  async processPayout(dealId: string) {
    const data = await this.db.transaction(async (client) => {
      const deal = (await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [dealId])).rows[0];
      if (!deal) throw new ConflictException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
      if (deal.status === 'completed') return { done: true as const };
      if (deal.payment_status !== 'captured') throw new ConflictException({ code: 'PAYOUT_CAPTURE_REQUIRED', message: 'Payment must be captured before payout' });

      const payout = (await client.query<any>('SELECT * FROM payout WHERE deal_id=$1 FOR UPDATE', [dealId])).rows[0];
      if (!payout) throw new ConflictException({ code: 'PAYOUT_NOT_PREPARED', message: 'Payout was not prepared' });
      if (payout.status === 'paid') return { done: true as const };

      const account = (await client.query<any>('SELECT * FROM payout_account WHERE id=$1', [payout.payout_account_id])).rows[0];
      if (!account) throw new ConflictException({ code: 'PAYOUT_ACCOUNT_NOT_FOUND', message: 'Payout account not found' });

      await client.query("UPDATE payout SET status='processing',attempts=attempts+1,updated_at=now() WHERE id=$1", [payout.id]);
      return { done: false as const, deal, payout, account };
    });

    if (data.done) return;

    const result = await this.payout(data.deal, data.payout, data.account);
    await this.db.transaction(async (client) => {
      const lockedDeal = (await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [dealId])).rows[0];
      if (!lockedDeal || lockedDeal.status === 'completed') return;

      if (result.status === 'paid') {
        const payoutFeeMinor = Number(result.feeMinor ?? 0);
        const acquiringFeeMinor = Number(lockedDeal.actual_acquiring_fee_minor ?? 0);
        const netRevenueMinor = this.economics.netRevenue(Number(lockedDeal.platform_fee_minor), acquiringFeeMinor, payoutFeeMinor);
        const actualNetMarginBps = this.economics.marginBps(netRevenueMinor, Number(lockedDeal.agreed_amount_minor));

        await client.query(
          `UPDATE payout SET status='paid',provider_reference=$2,provider_payload=$3::jsonb,provider_fee_minor=$4,paid_at=now(),updated_at=now() WHERE id=$1`,
          [data.payout.id, result.reference ?? null, JSON.stringify(result.payload ?? {}), payoutFeeMinor],
        );
        await client.query(
          `UPDATE deal SET status='completed',payment_status='released',settlement_status='settled',
             actual_payout_fee_minor=$2,platform_net_revenue_minor=$3,actual_net_margin_bps=$4,
             payout_completed_at=now(),completed_at=COALESCE(completed_at,now()),updated_at=now()
           WHERE id=$1`,
          [dealId, payoutFeeMinor, netRevenueMinor, actualNetMarginBps],
        );
        await client.query("UPDATE cargo SET status='delivered',updated_at=now() WHERE id=$1", [lockedDeal.cargo_id]);

        await this.ledger(client, dealId, data.payout.id, 'payout_fee', payoutFeeMinor, lockedDeal.currency, this.payoutMode(), result.reference ?? null, {});
        await this.ledger(client, dealId, data.payout.id, 'carrier_payout', lockedDeal.carrier_amount_minor, lockedDeal.currency, this.payoutMode(), result.reference ?? null, {});
        await this.ledger(client, dealId, data.payout.id, 'platform_net_revenue', netRevenueMinor, lockedDeal.currency, 'cargogo', null, { actualNetMarginBps });

        await client.query(
          `INSERT INTO deal_event(deal_id,actor_user_id,event_type,from_status,to_status,metadata)
           VALUES($1,NULL,'payout.paid','delivered','completed',$2::jsonb)`,
          [dealId, JSON.stringify({
            carrierAmountMinor: Number(lockedDeal.carrier_amount_minor),
            payoutFeeMinor,
            acquiringFeeMinor,
            platformNetRevenueMinor: netRevenueMinor,
            actualNetMarginBps,
            provider: this.payoutMode(),
          })],
        );

        await this.notifications.create({ userId: lockedDeal.driver_id, type: 'payout.paid', title: 'Виплату виконано', body: `Ваша виплата ${(Number(lockedDeal.carrier_amount_minor) / 100).toFixed(2)} ₴ відправлена.`, entityType: 'deal', entityId: dealId }, client);
        await this.notifications.create({ userId: lockedDeal.sender_id, type: 'deal.completed', title: 'Угоду завершено', body: 'Доставку підтверджено та фінансовий розрахунок завершено.', entityType: 'deal', entityId: dealId }, client);
      } else {
        await client.query("UPDATE payout SET status=$2,last_error=$3,provider_payload=$4::jsonb,updated_at=now() WHERE id=$1", [data.payout.id, result.status, result.error ?? null, JSON.stringify(result.payload ?? {})]);
        await client.query('UPDATE deal SET settlement_status=$2,updated_at=now() WHERE id=$1', [dealId, result.status === 'manual_review' ? 'manual_review' : 'payout_failed']);
      }
    });
  }

  private async capture(deal: any): Promise<CaptureResult> {
    const paymentMode = this.config.getOrThrow<string>('PAYMENTS_MODE');
    if (paymentMode === 'mock') {
      return {
        status: 'success',
        payment_id: `mock-capture-${deal.id}`,
        acquiringFeeMinor: Number(deal.estimated_acquiring_fee_minor ?? 0),
      };
    }

    if (!['liqpay_sandbox', 'liqpay_production'].includes(paymentMode)) {
      throw new ConflictException({ code: 'CAPTURE_PROVIDER_DISABLED', message: 'Payment capture provider is disabled' });
    }

    const publicKey = this.config.getOrThrow<string>('LIQPAY_PUBLIC_KEY');
    const privateKey = this.config.getOrThrow<string>('LIQPAY_PRIVATE_KEY');
    const params = {
      public_key: publicKey,
      version: 7,
      action: 'hold_completion',
      amount: (Number(deal.agreed_amount_minor) / 100).toFixed(2),
      currency: deal.currency,
      description: `CargoGo settlement ${deal.id.slice(0, 8)}`,
      order_id: deal.payment_reference,
    };
    const data = Buffer.from(JSON.stringify(params)).toString('base64');
    const signature = this.sign(data, privateKey);
    const response = await fetch(LIQPAY_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data, signature }).toString() });
    if (!response.ok) throw new ConflictException({ code: 'PAYMENT_CAPTURE_FAILED', message: 'LiqPay capture request failed' });

    const payload = await response.json() as ProviderResult;
    const status = String(payload.status ?? 'unknown');
    if (!['success', 'sandbox'].includes(status)) throw new ConflictException({ code: 'PAYMENT_CAPTURE_NOT_CONFIRMED', message: `LiqPay capture status: ${status}` });

    // LiqPay documents receiver_commission as the receiver commission in payment currency.
    const providerFeeMinor = this.economics.providerMoneyToMinor(payload.receiver_commission);
    return { ...payload, acquiringFeeMinor: providerFeeMinor ?? Number(deal.estimated_acquiring_fee_minor ?? 0) };
  }

  private async payout(deal: any, payout: any, account: any): Promise<PayoutResult> {
    const mode = this.payoutMode();
    if (mode === 'sandbox') {
      const details = this.payoutAccounts.decryptForProvider(account);
      return {
        status: 'paid',
        reference: `sandbox-payout-${payout.id}`,
        feeMinor: this.economics.sandboxPayoutFee(Number(payout.amount_minor)),
        payload: { sandbox: true, maskedIban: `UA…${details.iban.slice(-4)}` },
      };
    }

    // Live payout APIs require separate provider approval/capability. We never guess or send banking data to an unapproved API contract.
    return { status: 'manual_review', error: 'Automatic production payout provider capability is not enabled for this merchant' };
  }

  private payoutMode() { return this.config.getOrThrow<string>('PAYOUTS_MODE'); }
  private sign(data: string, key: string) { return createHash('sha3-256').update(key + data + key).digest('base64'); }

  private async ledger(client: any, dealId: string, payoutId: string | null, type: string, amount: any, currency: string, provider: string | null, reference: string | null, metadata: object) {
    const amountMinor = Number(amount);
    if (!Number.isSafeInteger(amountMinor)) throw new Error('Invalid ledger amount');
    await client.query(
      `INSERT INTO finance_ledger_entry(deal_id,payout_id,entry_type,amount_minor,currency,provider,provider_reference,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT(deal_id,entry_type) DO NOTHING`,
      [dealId, payoutId, type, amountMinor, currency, provider, reference, JSON.stringify(metadata)],
    );
  }
}
