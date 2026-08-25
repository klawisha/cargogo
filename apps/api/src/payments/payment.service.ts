import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { DealService } from '../deals/deal.service';
import type { RequestUser } from '../common/request-user';

const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';
const LIQPAY_API_URL = 'https://www.liqpay.ua/api/request';

type LiqPayStatus = { status?: string; order_id?: string; payment_id?: number | string; public_key?: string; amount?: number; currency?: string; [key:string]: unknown };

@Injectable()
export class PaymentService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly deals: DealService,
  ) {}

  async createCheckout(user: RequestUser, dealId: string) {
    const mode = this.mode();
    if (!this.isLiqPay(mode)) throw new ForbiddenException({ code:'PAYMENT_PROVIDER_DISABLED', message:'Hosted payment checkout is not enabled' });

    return this.db.transaction(async (client) => {
      const deal = (await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [dealId])).rows[0];
      if (!deal) throw new NotFoundException({ code:'DEAL_NOT_FOUND', message:'Deal not found' });
      if (deal.sender_id !== user.id) throw new ForbiddenException({ code:'PAYMENT_SENDER_ONLY', message:'Only sender can pay for the deal' });
      if (deal.status !== 'awaiting_payment') {
        if (['payment_secured','awaiting_pickup','picked_up','in_transit','arrived','delivered','completed'].includes(deal.status)) {
          return { alreadySecured:true, dealId, paymentStatus:deal.payment_status };
        }
        throw new ConflictException({ code:'PAYMENT_STATE_INVALID', message:'Deal is not waiting for payment' });
      }

      const token = randomBytes(32).toString('hex');
      const tokenHash = this.tokenHash(token);
      const provider = mode;
      const orderId = `cargogo-${deal.id}`;
      const attempt = await client.query<any>(
        `INSERT INTO payment_attempt(deal_id,provider,provider_order_id,amount_minor,currency,status,checkout_token_hash,checkout_token_expires_at)
         VALUES($1,$2,$3,$4,$5,'prepared',$6,now()+interval '20 minutes')
         ON CONFLICT (deal_id,provider) DO UPDATE SET
           amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,status=CASE WHEN payment_attempt.status='success' THEN payment_attempt.status ELSE 'prepared' END,
           checkout_token_hash=EXCLUDED.checkout_token_hash,checkout_token_expires_at=EXCLUDED.checkout_token_expires_at,updated_at=now()
         RETURNING *`,
        [deal.id, provider, orderId, deal.agreed_amount_minor, deal.currency, tokenHash],
      );
      if (attempt.rows[0].status === 'success') return { alreadySecured:true, dealId, paymentStatus:'secured' };
      await client.query("UPDATE deal SET payment_status='pending',payment_provider=$2,payment_reference=$3,updated_at=now() WHERE id=$1", [deal.id, provider, orderId]);
      const base = this.config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '');
      return {
        provider:'liqpay',
        environment: mode === 'liqpay_sandbox' ? 'sandbox' : 'production',
        checkoutUrl:`${base}/v1/payments/liqpay/checkout/${attempt.rows[0].id}?token=${token}`,
        expiresAt:attempt.rows[0].checkout_token_expires_at,
      };
    });
  }

  async syncDeal(user: RequestUser, dealId: string) {
    const attempt = await this.db.query<any>(
      `SELECT p.*,d.sender_id,d.driver_id,d.status AS deal_status FROM payment_attempt p JOIN deal d ON d.id=p.deal_id
       WHERE p.deal_id=$1 ORDER BY p.created_at DESC LIMIT 1`, [dealId],
    );
    const row = attempt.rows[0];
    if (!row) throw new NotFoundException({ code:'PAYMENT_ATTEMPT_NOT_FOUND', message:'Payment attempt not found' });
    if (row.sender_id !== user.id && row.driver_id !== user.id) throw new ForbiddenException({ code:'DEAL_FORBIDDEN', message:'Not your deal' });
    await this.syncAttempt(row);
    return this.deals.getMine(user, dealId);
  }

  async checkoutHtml(paymentId: string, token: string) {
    const row = await this.getAttemptByToken(paymentId, token);
    if (!this.isLiqPay(row.provider)) throw new BadRequestException('Unsupported payment provider');
    if (row.status === 'success') return this.messagePage('Оплату вже підтверджено', row.deal_id, true);

    const publicKey = this.config.getOrThrow<string>('LIQPAY_PUBLIC_KEY');
    const privateKey = this.config.getOrThrow<string>('LIQPAY_PRIVATE_KEY');
    const base = this.config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '');
    const amount = (Number(row.amount_minor) / 100).toFixed(2);
    const params: Record<string, unknown> = {
      public_key: publicKey,
      version: 7,
      action: 'hold',
      amount,
      currency: row.currency,
      description: `CargoGo: оплата перевезення ${row.deal_id.slice(0,8)}`,
      order_id: row.provider_order_id,
      result_url: `${base}/v1/payments/liqpay/result/${row.id}?token=${token}`,
      language: 'uk',
    };
    if (!this.isLocalBase(base)) params.server_url = `${base}/v1/payments/liqpay/callback`;
    const data = Buffer.from(JSON.stringify(params)).toString('base64');
    const signature = this.sign(data, privateKey);
    await this.db.query("UPDATE payment_attempt SET status=CASE WHEN status='prepared' THEN 'pending' ELSE status END,updated_at=now() WHERE id=$1", [row.id]);
    return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CargoGo → LiqPay</title><style>body{margin:0;background:#090a0c;color:#f4f1ec;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:520px;padding:32px;border:1px solid #2d3035;background:#111318}.a{color:#dfa07d}.muted{color:#8d8f95;font-size:14px;line-height:1.5}</style></head><body><div class="box"><h2>CargoGo</h2><p class="a">Перехід до захищеної сторінки LiqPay…</p><p class="muted">Сума: ${this.escape(amount)} ${this.escape(row.currency)}. Дані картки CargoGo не отримує.</p><form id="pay" method="POST" action="${LIQPAY_CHECKOUT_URL}"><input type="hidden" name="data" value="${this.escape(data)}"><input type="hidden" name="signature" value="${this.escape(signature)}"></form></div><script>document.getElementById('pay').submit()</script></body></html>`;
  }

  async resultHtml(paymentId: string, token: string) {
    const row = await this.getAttemptByToken(paymentId, token);
    const latest = await this.syncAttempt(row);
    const ok = this.isSuccessfulStatus(latest.status);
    return this.messagePage(ok ? 'Оплату підтверджено' : 'Платіж ще обробляється', row.deal_id, ok, latest.status ?? 'unknown');
  }

  async callback(body: { data?: string; signature?: string }) {
    if (!body.data || !body.signature) throw new BadRequestException('Missing LiqPay callback fields');
    const privateKey = this.config.getOrThrow<string>('LIQPAY_PRIVATE_KEY');
    if (!this.safeEqual(body.signature, this.sign(body.data, privateKey))) throw new ForbiddenException('Invalid LiqPay callback signature');
    const payload = JSON.parse(Buffer.from(body.data, 'base64').toString('utf8')) as LiqPayStatus;
    if (!payload.order_id) throw new BadRequestException('Missing LiqPay order_id');
    const attempt = await this.db.query<any>('SELECT * FROM payment_attempt WHERE provider_order_id=$1 LIMIT 1', [payload.order_id]);
    if (!attempt.rows[0]) return { ok:true };
    await this.processStatus(attempt.rows[0], payload);
    return { ok:true };
  }

  private async syncAttempt(row: any): Promise<LiqPayStatus> {
    if (!this.isLiqPay(row.provider)) return { status: row.status };
    const publicKey = this.config.getOrThrow<string>('LIQPAY_PUBLIC_KEY');
    const privateKey = this.config.getOrThrow<string>('LIQPAY_PRIVATE_KEY');
    const data = Buffer.from(JSON.stringify({ action:'status', version:7, public_key:publicKey, order_id:row.provider_order_id })).toString('base64');
    const signature = this.sign(data, privateKey);
    const response = await fetch(LIQPAY_API_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:new URLSearchParams({ data, signature }).toString(),
    });
    if (!response.ok) throw new ConflictException({ code:'PAYMENT_PROVIDER_UNAVAILABLE', message:'LiqPay status request failed' });
    const payload = await response.json() as LiqPayStatus;
    await this.processStatus(row, payload);
    return payload;
  }

  private async processStatus(row: any, payload: LiqPayStatus) {
    if (payload.order_id && payload.order_id !== row.provider_order_id) throw new ConflictException({ code:'PAYMENT_ORDER_MISMATCH', message:'Payment order mismatch' });
    const status = String(payload.status ?? 'unknown');
    await this.db.query(
      `UPDATE payment_attempt SET status=$2,provider_payment_id=COALESCE($3,provider_payment_id),provider_payload=$4::jsonb,completed_at=CASE WHEN $5 THEN COALESCE(completed_at,now()) ELSE completed_at END,updated_at=now() WHERE id=$1`,
      [row.id, status, payload.payment_id ? String(payload.payment_id) : null, JSON.stringify(payload), this.isTerminalStatus(status)],
    );
    if (this.isSuccessfulStatus(status)) await this.deals.secureProviderPayment(row.deal_id, row.provider, row.provider_order_id, status);
    if (['failure','error','reversed'].includes(status)) await this.db.query("UPDATE deal SET payment_status='failed',updated_at=now() WHERE id=$1 AND status='awaiting_payment'", [row.deal_id]);
  }

  private async getAttemptByToken(paymentId: string, token: string) {
    if (!token || token.length < 20) throw new ForbiddenException('Invalid checkout token');
    const result = await this.db.query<any>('SELECT * FROM payment_attempt WHERE id=$1 LIMIT 1', [paymentId]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Payment attempt not found');
    if (new Date(row.checkout_token_expires_at).getTime() < Date.now()) throw new ForbiddenException('Checkout link expired');
    if (!this.safeEqual(this.tokenHash(token), row.checkout_token_hash)) throw new ForbiddenException('Invalid checkout token');
    return row;
  }

  private mode() { return this.config.getOrThrow<string>('PAYMENTS_MODE'); }
  private isLiqPay(mode: string) { return mode === 'liqpay_sandbox' || mode === 'liqpay_production'; }
  private tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private sign(data: string, privateKey: string) { return createHash('sha3-256').update(privateKey + data + privateKey).digest('base64'); }
  private safeEqual(a: string, b: string) { const aa=Buffer.from(a); const bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
  private isSuccessfulStatus(status?: string) { return status === 'success' || status === 'hold_wait' || (status === 'sandbox' && this.mode() === 'liqpay_sandbox'); }
  private isTerminalStatus(status: string) { return ['success','failure','error','reversed','hold_wait','sandbox'].includes(status); }
  private isLocalBase(base:string) { try { const u=new URL(base); return ['localhost','127.0.0.1'].includes(u.hostname); } catch { return true; } }
  private escape(value: unknown) { return String(value).replace(/[&<>'"]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c] ?? c)); }
  private messagePage(title:string,dealId:string,ok:boolean,status?:string) {
    const deep=`cargogo://deal/${dealId}`;
    return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CargoGo payment</title><style>body{margin:0;background:#090a0c;color:#f4f1ec;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:520px;padding:32px;border:1px solid #2d3035;background:#111318}.accent{color:#dfa07d}.muted{color:#8d8f95;line-height:1.5}.btn{display:block;margin-top:22px;background:#dfa07d;color:#1b1210;text-decoration:none;font-weight:800;padding:16px;text-align:center}</style></head><body><div class="box"><div class="accent">${ok?'PAYMENT OK':'PAYMENT STATUS'}</div><h2>${this.escape(title)}</h2><p class="muted">Статус LiqPay: ${this.escape(status ?? (ok?'success':'processing'))}. Поверніться в CargoGo — застосунок повторно перевірить статус на сервері.</p><a class="btn" href="${deep}">ПОВЕРНУТИСЯ В CARGOGO</a></div><script>setTimeout(()=>{location.href=${JSON.stringify(deep)}},800)</script></body></html>`;
  }
}
