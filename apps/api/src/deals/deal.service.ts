import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { MatchingService } from '../matching/matching.service';
import type { RequestUser } from '../common/request-user';
import { NotificationService } from '../notifications/notification.service';
import { PayoutAccountService } from '../payout-accounts/payout-account.service';
import { SettlementService } from '../settlement/settlement.service';
import { EconomicsService } from '../economics/economics.service';
import { VerificationStorageService } from '../verification/verification-storage.service';

type CodeKind = 'pickup' | 'delivery';
type ReviewInput = { rating: number; comment?: string };

@Injectable()
export class DealService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly matching: MatchingService,
    private readonly notifications: NotificationService,
    private readonly payoutAccounts: PayoutAccountService,
    private readonly settlement: SettlementService,
    private readonly economics: EconomicsService,
    private readonly evidenceStorage: VerificationStorageService,
  ) {}

  async acceptOffer(user: RequestUser, offerId: string) {
    const justExpired = await this.db.query<{ id: string }>(
      "UPDATE cargo_offer SET status='expired',updated_at=now() WHERE id=$1 AND status='pending' AND expires_at<=now() RETURNING id",
      [offerId],
    );
    if (justExpired.rows[0]) throw new ConflictException({ code: 'OFFER_EXPIRED', message: 'Offer expired' });

    return this.db.transaction(async (client) => {
      const offerResult = await client.query<any>('SELECT * FROM cargo_offer WHERE id=$1 FOR UPDATE', [offerId]);
      const offer = offerResult.rows[0];
      if (!offer) throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: 'Offer not found' });
      if (offer.cargo_owner_id !== user.id) throw new ForbiddenException({ code: 'OFFER_FORBIDDEN', message: 'Only cargo owner can accept this offer' });
      if (offer.status === 'accepted') {
        const existingDeal = await client.query<{ id: string }>('SELECT id FROM deal WHERE offer_id=$1 LIMIT 1', [offer.id]);
        if (existingDeal.rows[0]) return this.getWithClient(client, user.id, existingDeal.rows[0].id);
      }
      if (offer.status !== 'pending') throw new ConflictException({ code: 'OFFER_NOT_PENDING', message: 'Offer is no longer pending' });

      const cargoResult = await client.query<any>('SELECT * FROM cargo WHERE id=$1 FOR UPDATE', [offer.cargo_id]);
      const cargo = cargoResult.rows[0];
      if (!cargo || cargo.owner_id !== user.id) throw new NotFoundException({ code: 'CARGO_NOT_FOUND', message: 'Cargo not found' });
      if (cargo.status !== 'published') throw new ConflictException({ code: 'CARGO_NOT_AVAILABLE', message: 'Cargo is no longer available' });

      const tripResult = await client.query<any>('SELECT * FROM trip WHERE id=$1 FOR UPDATE', [offer.trip_id]);
      const trip = tripResult.rows[0];
      if (!trip || trip.driver_id !== offer.driver_id || trip.status !== 'published') throw new ConflictException({ code: 'TRIP_NOT_AVAILABLE', message: 'Driver trip is no longer available' });

      const match = await client.query('SELECT 1 FROM trip_match WHERE trip_id=$1 AND cargo_id=$2', [offer.trip_id, offer.cargo_id]);
      if (!match.rowCount) throw new ConflictException({ code: 'MATCH_NO_LONGER_VALID', message: 'Trip and cargo no longer match' });

      const existing = await client.query<{ id: string }>("SELECT id FROM deal WHERE cargo_id=$1 AND status NOT IN ('cancelled','refunded','completed') FOR UPDATE", [offer.cargo_id]);
      if (existing.rows[0]) throw new ConflictException({ code: 'CARGO_ALREADY_MATCHED', message: 'Cargo already has an active deal' });

      const payoutAccount = await this.payoutAccounts.requireActive(offer.driver_id, client);
      const economics = this.economics.snapshot(Number(offer.amount_minor));

      const created = await client.query<{ id: string }>(
        `INSERT INTO deal(
           cargo_id,trip_id,offer_id,sender_id,driver_id,agreed_amount_minor,currency,
           platform_fee_minor,carrier_amount_minor,payout_account_id,declared_value_minor_snapshot,declared_value_currency_snapshot,
           target_net_margin_minor,estimated_acquiring_fee_minor,estimated_payout_fee_minor,fee_policy_snapshot,carrier_mode_snapshot
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17) RETURNING id`,
        [
          offer.cargo_id, offer.trip_id, offer.id, user.id, offer.driver_id, offer.amount_minor, offer.currency,
          economics.platformFeeMinor, economics.carrierAmountMinor, payoutAccount.id,
          cargo.declared_value_minor??null, cargo.declared_value_currency??null,
          economics.targetNetMarginMinor, economics.estimatedAcquiringFeeMinor, economics.estimatedPayoutFeeMinor, JSON.stringify(economics.policy), trip.carrier_mode_snapshot??offer.carrier_mode_snapshot??'casual',
        ],
      );
      const dealId = created.rows[0].id;
      await client.query('INSERT INTO deal_conversation(deal_id) VALUES($1)', [dealId]);
      await client.query("UPDATE cargo_offer SET status='accepted',updated_at=now() WHERE id=$1", [offer.id]);
      await client.query("UPDATE cargo_offer SET status='superseded',updated_at=now() WHERE cargo_id=$1 AND id<>$2 AND status='pending'", [offer.cargo_id, offer.id]);
      await client.query("UPDATE cargo SET status='matched',updated_at=now() WHERE id=$1", [offer.cargo_id]);
      await client.query('DELETE FROM trip_match WHERE cargo_id=$1', [offer.cargo_id]);
      await this.event(client, dealId, user.id, 'deal.created', null, 'awaiting_payment', { offerId: offer.id, platformFeeMinor: economics.platformFeeMinor, carrierAmountMinor: economics.carrierAmountMinor, targetNetMarginMinor: economics.targetNetMarginMinor, estimatedAcquiringFeeMinor: economics.estimatedAcquiringFeeMinor, estimatedPayoutFeeMinor: economics.estimatedPayoutFeeMinor, feePolicy: economics.policy, declaredValueMinor: cargo.declared_value_minor??null, declaredValueCurrency: cargo.declared_value_currency??null });
      await this.audit(client, user, 'deal.created', dealId, { offerId: offer.id, cargoId: offer.cargo_id, tripId: offer.trip_id });
      await this.notifications.create({userId:offer.driver_id,type:'deal.created',title:'Пропозицію прийнято',body:'Власник вантажу прийняв вашу пропозицію. Очікується оплата.',entityType:'deal',entityId:dealId},client);
      return this.getWithClient(client, user.id, dealId);
    });
  }

  async devSecurePayment(user: RequestUser, id: string) {
    if (this.config.get<string>('NODE_ENV') === 'production' || this.config.get<string>('PAYMENTS_MODE') !== 'mock') {
      throw new ForbiddenException({ code: 'MOCK_PAYMENT_DISABLED', message: 'Development payment simulation is disabled' });
    }
    return this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client, user, id);
      if (deal.sender_id !== user.id) throw new ForbiddenException({ code: 'PAYMENT_SENDER_ONLY', message: 'Only sender can secure payment' });
      if (['awaiting_pickup','picked_up','in_transit','arrived','delivered','completed'].includes(deal.status)) return this.getWithClient(client, user.id, id);
      if (deal.status !== 'awaiting_payment') throw new ConflictException({ code: 'PAYMENT_STATE_INVALID', message: 'Deal is not waiting for payment' });

      const pickupCode = this.generateCode();
      const deliveryCode = this.generateCode();
      await client.query(
        `UPDATE deal SET status='payment_secured',payment_status='secured',payment_secured_at=now(),pickup_code_hash=$2,delivery_code_hash=$3,pickup_code_ciphertext=$4,delivery_code_ciphertext=$5,updated_at=now() WHERE id=$1`,
        [id, this.codeHash(pickupCode), this.codeHash(deliveryCode), this.encryptCode(pickupCode), this.encryptCode(deliveryCode)],
      );
      await client.query(`INSERT INTO finance_ledger_entry(deal_id,entry_type,amount_minor,currency,provider,provider_reference,metadata) VALUES($1,'customer_hold',$2,$3,'mock',$4,'{}'::jsonb) ON CONFLICT(deal_id,entry_type) DO NOTHING`,[id,deal.agreed_amount_minor,deal.currency,`mock-hold-${id}`]);
      await this.event(client, id, user.id, 'payment.mock_secured', 'awaiting_payment', 'payment_secured', { mode: 'mock' });
      await client.query("UPDATE deal SET status='awaiting_pickup',updated_at=now() WHERE id=$1", [id]);
      await this.event(client, id, user.id, 'deal.awaiting_pickup', 'payment_secured', 'awaiting_pickup', {});
      await this.audit(client, user, 'payment.mock_secured', id, { mode: 'mock' });
      await this.notifications.create({userId:deal.driver_id,type:'payment.secured',title:'Оплату забезпечено',body:'Можна переходити до передачі вантажу.',entityType:'deal',entityId:id},client);
      return this.getWithClient(client, user.id, id);
    });
  }


  async secureProviderPayment(id: string, provider: string, reference: string, providerStatus: string) {
    return this.db.transaction(async (client) => {
      const deal = (await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!deal) throw new NotFoundException({ code:'DEAL_NOT_FOUND', message:'Deal not found' });
      if (['awaiting_pickup','picked_up','in_transit','arrived','delivered','completed'].includes(deal.status)) return;
      if (deal.status !== 'awaiting_payment') throw new ConflictException({ code:'PAYMENT_STATE_INVALID', message:'Deal is not waiting for payment' });
      const pickupCode = this.generateCode();
      const deliveryCode = this.generateCode();
      await client.query(
        `UPDATE deal SET status='payment_secured',payment_status='secured',payment_provider=$2,payment_reference=$3,payment_secured_at=now(),pickup_code_hash=$4,delivery_code_hash=$5,pickup_code_ciphertext=$6,delivery_code_ciphertext=$7,updated_at=now() WHERE id=$1`,
        [id, provider, reference, this.codeHash(pickupCode), this.codeHash(deliveryCode), this.encryptCode(pickupCode), this.encryptCode(deliveryCode)],
      );
      await client.query(`INSERT INTO finance_ledger_entry(deal_id,entry_type,amount_minor,currency,provider,provider_reference,metadata) VALUES($1,'customer_hold',$2,$3,$4,$5,$6::jsonb) ON CONFLICT(deal_id,entry_type) DO NOTHING`,[id,deal.agreed_amount_minor,deal.currency,provider,reference,JSON.stringify({providerStatus})]);
      await this.event(client, id, null, 'payment.provider_secured', 'awaiting_payment', 'payment_secured', { provider, reference, providerStatus });
      await client.query("UPDATE deal SET status='awaiting_pickup',updated_at=now() WHERE id=$1", [id]);
      await this.event(client, id, null, 'deal.awaiting_pickup', 'payment_secured', 'awaiting_pickup', {});
      await this.notifications.create({userId:deal.driver_id,type:'payment.secured',title:'Оплату підтверджено',body:'Платіжний провайдер підтвердив оплату. Можна переходити до передачі вантажу.',entityType:'deal',entityId:id},client);
    });
  }

  async uploadHandoverEvidence(
    user: RequestUser,
    id: string,
    input: { stage: 'pickup' | 'delivery'; note?: string; latitude?:number; longitude?:number; accuracyMeters?:number; clientCapturedAt?:string; locationStatus?:'captured'|'permission_denied'|'unavailable' },
    file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const mimeType = (file.mimetype ?? '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg','image/png'].includes(mimeType)) {
      throw new BadRequestException({ code: 'EVIDENCE_IMAGE_REQUIRED', message: 'Pickup and delivery evidence must be a JPEG or PNG photo' });
    }
    const size = Number(file.size ?? file.buffer?.length ?? 0);
    if (!file.buffer || size < 1 || size !== file.buffer.length || size > 10 * 1024 * 1024) {
      throw new BadRequestException({ code: 'EVIDENCE_SIZE_INVALID', message: 'Evidence photo must be between 1 byte and 10 MB' });
    }
    const detected = this.evidenceStorage.detectMime(file.buffer);
    if (detected !== mimeType || !['image/jpeg','image/png'].includes(detected)) {
      throw new BadRequestException({ code: 'EVIDENCE_CONTENT_INVALID', message: 'Evidence file contents do not match the declared image type' });
    }

    const deal = await this.db.query<any>('SELECT * FROM deal WHERE id=$1 AND (sender_id=$2 OR driver_id=$2)', [id, user.id]);
    const row = deal.rows[0];
    if (!row) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    const participantRole=row.driver_id===user.id?'driver':row.sender_id===user.id?'sender':null;
    if (!participantRole) throw new ForbiddenException({ code:'EVIDENCE_PARTICIPANT_ONLY', message:'Only deal participants can capture evidence' });
    if(input.stage==='pickup'&&participantRole!=='driver') throw new ForbiddenException({code:'EVIDENCE_DRIVER_ONLY',message:'Only driver can capture pickup evidence'});
    const requiredStatus = input.stage === 'pickup' ? 'awaiting_pickup' : 'arrived';
    if (row.status !== requiredStatus) throw new ConflictException({ code: 'EVIDENCE_STATE_INVALID', message: `Evidence for ${input.stage} is not accepted in the current deal state` });

    let hs:any=null;
    if(input.stage==='delivery'){
      const h=await this.db.query<any>('SELECT * FROM deal_handover_session WHERE deal_id=$1',[id]);
      hs=h.rows[0];
      if(!hs?.started_at)throw new ConflictException({code:'HANDOVER_NOT_STARTED',message:'Start the synchronized handover before delivery photos'});
    }
    const count = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM deal_handover_evidence
       WHERE deal_id=$1 AND stage=$2 AND ($2='pickup' OR participant_role=$3)`,
      [id,input.stage,participantRole],
    );
    if (Number(count.rows[0]?.count ?? 0) >= 3) {
      throw new ConflictException({ code: 'EVIDENCE_LIMIT_REACHED', message: 'A maximum of 3 evidence photos is allowed for this participant at this handover stage' });
    }

    const synchronizationGrade = input.stage==='delivery' && hs?.started_at
      ? (()=>{const elapsed=(Date.now()-new Date(hs.started_at).getTime())/1000;return elapsed<=60?'strong':elapsed<=120?'acceptable':'late';})()
      : null;
    const evidenceId = randomUUID();
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const objectKey = `deal-evidence/${id}/${input.stage}/${evidenceId}.${ext}`;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    try {
      await this.evidenceStorage.putObject(objectKey, file.buffer, mimeType);
      const inserted = await this.db.query<any>(
        `INSERT INTO deal_handover_evidence(
           id,deal_id,actor_user_id,stage,object_key,mime_type,size_bytes,sha256_hex,note,
           latitude,longitude,accuracy_meters,client_captured_at,location_status,
           participant_role,handover_session_id,synchronization_grade
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id,stage,mime_type,size_bytes,sha256_hex,note,server_captured_at,latitude,longitude,accuracy_meters,client_captured_at,location_status,participant_role,handover_session_id,synchronization_grade`,
        [evidenceId,id,user.id,input.stage,objectKey,mimeType,size,sha256,input.note?.trim()||null,
         input.latitude??null,input.longitude??null,input.accuracyMeters??null,input.clientCapturedAt??null,
         input.locationStatus??(input.latitude!==undefined&&input.longitude!==undefined?'captured':'unavailable'),
         participantRole,hs?.id??null,synchronizationGrade],
      );
      await this.db.query(`INSERT INTO deal_event(deal_id,actor_user_id,event_type,from_status,to_status,metadata) VALUES($1,$2,'handover.evidence_uploaded',$3,$3,$4::jsonb)`, [id,user.id,row.status,JSON.stringify({stage:input.stage,evidenceId,sha256})]);
      await this.db.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'handover.evidence_uploaded','deal',$3,$4::jsonb)`, [user.id,user.sessionId,id,JSON.stringify({stage:input.stage,evidenceId,sha256,size,mimeType,locationStatus:input.locationStatus??'unavailable',accuracyMeters:input.accuracyMeters??null})]);
      return this.evidenceDto(inserted.rows[0]);
    } catch (error:any) {
      await this.evidenceStorage.deleteObject(objectKey).catch(()=>{});
      if(error?.code==='23514' && String(error?.message??'').includes('handover evidence limit reached')) {
        throw new ConflictException({code:'EVIDENCE_LIMIT_REACHED',message:'A maximum of 3 evidence photos is allowed for this participant at this handover stage'});
      }
      throw error;
    }
  }

  async handoverEvidenceAccess(user: RequestUser, id: string, evidenceId: string, purpose: string, publicBaseUrl: string) {
    const r = await this.db.query<any>(
      `SELECT e.* FROM deal_handover_evidence e JOIN deal d ON d.id=e.deal_id
       WHERE e.id=$1 AND e.deal_id=$2 AND (d.sender_id=$3 OR d.driver_id=$3 OR $4)`,
      [evidenceId,id,user.id,(user.staffRole==='reviewer'||user.staffRole==='dispute_reviewer'||user.staffRole==='admin')],
    );
    const evidence = r.rows[0];
    if (!evidence) throw new NotFoundException({ code:'HANDOVER_EVIDENCE_NOT_FOUND', message:'Handover evidence not found' });
    await this.db.query(`INSERT INTO deal_handover_evidence_access_log(evidence_id,actor_user_id,purpose) VALUES($1,$2,$3)`, [evidenceId,user.id,purpose.trim()]);
    return { url: this.evidenceStorage.proxyUrl(evidence.object_key, 300, publicBaseUrl), expiresInSeconds: 300 };
  }

  private async requireHandoverEvidence(client: PoolClient, dealId: string, stage: CodeKind) {
    const r = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM deal_handover_evidence WHERE deal_id=$1 AND stage=$2', [dealId,stage]);
    if (Number(r.rows[0]?.count ?? 0) < 1) {
      throw new ConflictException({ code: stage === 'pickup' ? 'PICKUP_EVIDENCE_REQUIRED' : 'DELIVERY_EVIDENCE_REQUIRED', message: `Capture at least one ${stage} photo before entering the handover code` });
    }
  }

  async confirmPickup(user: RequestUser, id: string, code: string) {
    const result = await this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client, user, id);
      if (deal.driver_id !== user.id) throw new ForbiddenException({ code: 'PICKUP_DRIVER_ONLY', message: 'Only driver can confirm pickup' });
      if (['picked_up','in_transit','arrived','delivered','completed'].includes(deal.status)) return { deal: await this.getWithClient(client, user.id, id) };
      if (deal.status !== 'awaiting_pickup') throw new ConflictException({ code: 'PICKUP_STATE_INVALID', message: 'Deal is not ready for pickup' });
      await this.requireHandoverEvidence(client,id,'pickup');
      if (deal.pickup_locked_until && new Date(deal.pickup_locked_until).getTime() > Date.now()) {
        return { error: { code: 'PICKUP_CODE_LOCKED', message: 'Too many incorrect pickup code attempts. Try later.' } };
      }
      if (!this.safeCodeHashEqual(code, deal.pickup_code_hash)) {
        const attempts = Number(deal.pickup_attempts ?? 0) + 1;
        const lock = attempts >= 5;
        await client.query(`UPDATE deal SET pickup_attempts=$2,pickup_locked_until=CASE WHEN $3 THEN now()+interval '5 minutes' ELSE NULL END,updated_at=now() WHERE id=$1`, [id, attempts, lock]);
        await this.event(client, id, user.id, 'pickup.code_failed', 'awaiting_pickup', 'awaiting_pickup', { attempts, locked: lock });
        return { error: { code: lock ? 'PICKUP_CODE_LOCKED' : 'PICKUP_CODE_INVALID', message: lock ? 'Too many incorrect pickup code attempts. Try later.' : 'Pickup code is incorrect' } };
      }
      await client.query(`UPDATE deal SET status='picked_up',pickup_attempts=0,pickup_locked_until=NULL,pickup_verified_at=now(),pickup_code_hash=NULL,pickup_code_ciphertext=NULL,updated_at=now() WHERE id=$1`, [id]);
      await this.event(client, id, user.id, 'pickup.verified', 'awaiting_pickup', 'picked_up', {});
      await this.audit(client, user, 'pickup.verified', id, {});
      await this.notifications.create({userId:deal.sender_id,type:'pickup.verified',title:'Вантаж передано',body:'Код забору підтверджено перевізником.',entityType:'deal',entityId:id},client);
      return { deal: await this.getWithClient(client, user.id, id) };
    });
    if ('error' in result) throw new ConflictException(result.error);
    return result.deal;
  }

  async startTransit(user: RequestUser, id: string) {
    return this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client, user, id);
      if (deal.driver_id !== user.id) throw new ForbiddenException({ code: 'TRANSIT_DRIVER_ONLY', message: 'Only driver can start transit' });
      if (['in_transit','arrived','delivered','completed'].includes(deal.status)) return this.getWithClient(client, user.id, id);
      if (deal.status !== 'picked_up') throw new ConflictException({ code: 'TRANSIT_STATE_INVALID', message: 'Cargo must be picked up first' });
      await client.query("UPDATE deal SET status='in_transit',transit_started_at=now(),updated_at=now() WHERE id=$1", [id]);
      await client.query("UPDATE cargo SET status='in_transit',updated_at=now() WHERE id=$1", [deal.cargo_id]);
      await this.event(client, id, user.id, 'transit.started', 'picked_up', 'in_transit', {});
      await this.audit(client, user, 'transit.started', id, {});
      await this.notifications.create({userId:deal.sender_id,type:'transit.started',title:'Вантаж у дорозі',body:'Перевізник розпочав поїздку з вашим вантажем.',entityType:'deal',entityId:id},client);
      return this.getWithClient(client, user.id, id);
    });
  }

  async markArrived(user: RequestUser, id: string) {
    return this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client, user, id);
      if (deal.driver_id !== user.id) throw new ForbiddenException({ code: 'ARRIVAL_DRIVER_ONLY', message: 'Only driver can mark arrival' });
      if (['arrived','delivered','completed'].includes(deal.status)) return this.getWithClient(client, user.id, id);
      if (deal.status !== 'in_transit') throw new ConflictException({ code: 'ARRIVAL_STATE_INVALID', message: 'Deal must be in transit first' });
      await client.query("UPDATE deal SET status='arrived',arrived_at=now(),updated_at=now() WHERE id=$1", [id]);
      await client.query(`INSERT INTO deal_handover_session(id,deal_id,driver_arrived_at) VALUES($1,$2,now()) ON CONFLICT(deal_id) DO UPDATE SET driver_arrived_at=COALESCE(deal_handover_session.driver_arrived_at,now()),updated_at=now()`,[randomUUID(),id]);
      await this.event(client, id, user.id, 'delivery.arrived', 'in_transit', 'arrived', {});
      await this.audit(client, user, 'delivery.arrived', id, {});
      await this.notifications.create({userId:deal.sender_id,type:'delivery.arrived',title:'Перевізник прибув',body:'Перевізник позначив прибуття до отримувача.',entityType:'deal',entityId:id},client);
      return this.getWithClient(client, user.id, id);
    });
  }

  async markRecipientPresent(user: RequestUser,id:string,input:any) {
    return this.db.transaction(async client=>{
      const deal=await this.lockParticipantDeal(client,user,id);
      if(deal.sender_id!==user.id) throw new ForbiddenException({code:'HANDOVER_SENDER_ONLY',message:'Only the recipient/sender can confirm presence'});
      if(deal.status!=='arrived') throw new ConflictException({code:'HANDOVER_STATE_INVALID',message:'Driver must arrive before recipient presence can be confirmed'});
      await client.query(`INSERT INTO deal_handover_session(id,deal_id,recipient_present_at,recipient_latitude,recipient_longitude,recipient_accuracy_meters) VALUES($1,$2,now(),$3,$4,$5) ON CONFLICT(deal_id) DO UPDATE SET recipient_present_at=COALESCE(deal_handover_session.recipient_present_at,now()),recipient_latitude=COALESCE(deal_handover_session.recipient_latitude,$3),recipient_longitude=COALESCE(deal_handover_session.recipient_longitude,$4),recipient_accuracy_meters=COALESCE(deal_handover_session.recipient_accuracy_meters,$5),updated_at=now()`,[randomUUID(),id,input.latitude??null,input.longitude??null,input.accuracyMeters??null]);
      await this.event(client,id,user.id,'handover.recipient_present','arrived','arrived',{locationStatus:input.locationStatus});
      await this.notifications.create({userId:deal.driver_id,type:'handover.recipient_present',title:'Отримувач на місці',body:'Отримувач підтвердив присутність. Можна починати передачу вантажу.',entityType:'deal',entityId:id},client);
      return this.getWithClient(client,user.id,id);
    });
  }

  async startHandoverSession(user:RequestUser,id:string) {
    return this.db.transaction(async client=>{
      const deal=await this.lockParticipantDeal(client,user,id);
      if(deal.driver_id!==user.id) throw new ForbiddenException({code:'HANDOVER_DRIVER_ONLY',message:'Only driver can start handover'});
      if(deal.status!=='arrived') throw new ConflictException({code:'HANDOVER_STATE_INVALID',message:'Deal must be arrived'});
      const q=await client.query<any>('SELECT * FROM deal_handover_session WHERE deal_id=$1 FOR UPDATE',[id]); const hs=q.rows[0];
      if(!hs?.driver_arrived_at||!hs?.recipient_present_at) throw new ConflictException({code:'HANDOVER_BOTH_PRESENT_REQUIRED',message:'Both participants must confirm presence before handover starts'});
      if(!hs.started_at) await client.query('UPDATE deal_handover_session SET started_at=now(),started_by=$2,updated_at=now() WHERE deal_id=$1',[id,user.id]);
      await this.event(client,id,user.id,'handover.started','arrived','arrived',{}); await this.notifications.create({userId:deal.sender_id,type:'handover.started',title:'Передача розпочалась',body:'Перевізник запустив синхронну фотофіксацію передачі вантажу.',entityType:'deal',entityId:id},client); return this.getWithClient(client,user.id,id);
    });
  }

  async reportDeliveryProblem(user: RequestUser, id: string, input: {
    reason:'recipient_refuses_code'|'recipient_claims_damage'|'recipient_unavailable'|'other';
    note:string; latitude?:number; longitude?:number; accuracyMeters?:number; locationCapturedAt?:string;
    locationStatus:'captured'|'permission_denied'|'unavailable';
  }) {
    return this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client,user,id);
      if (deal.driver_id !== user.id) throw new ForbiddenException({code:'DELIVERY_PROBLEM_DRIVER_ONLY',message:'Only the assigned driver can report a delivery confirmation problem'});
      if (deal.status === 'disputed') {
        const existing = await client.query<any>("SELECT id FROM deal_dispute WHERE deal_id=$1 AND status IN ('open','under_review') ORDER BY created_at DESC LIMIT 1",[id]);
        return {deal:await this.getWithClient(client,user.id,id),disputeId:existing.rows[0]?.id??null,alreadyReported:true};
      }
      if (deal.status !== 'arrived') throw new ConflictException({code:'DELIVERY_PROBLEM_STATE_INVALID',message:'Delivery confirmation problems can be reported only after arrival'});
      await this.requireHandoverEvidence(client,id,'delivery');

      const existing = await client.query<any>("SELECT id FROM deal_dispute WHERE deal_id=$1 AND status IN ('open','under_review') FOR UPDATE",[id]);
      if (existing.rows[0]) {
        await client.query("UPDATE deal SET dispute_previous_status=status,status='disputed',settlement_status=CASE WHEN settlement_status='settled' THEN settlement_status ELSE 'manual_review' END,updated_at=now() WHERE id=$1",[id]);
        return {deal:await this.getWithClient(client,user.id,id),disputeId:existing.rows[0].id,alreadyReported:true};
      }

      const description = `Delivery confirmation problem: ${input.reason}. ${input.note.trim()}`;
      const dispute = await client.query<any>(
        `INSERT INTO deal_dispute(deal_id,opened_by,reason_code,description)
         VALUES($1,$2,'delivery_confirmation_refused',$3) RETURNING id`,
        [id,user.id,description],
      );
      const disputeId=dispute.rows[0].id;
      await client.query(
        `INSERT INTO deal_delivery_confirmation_problem(
           deal_id,dispute_id,reported_by,reason,note,latitude,longitude,accuracy_meters,client_location_at,location_status
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT(deal_id) DO NOTHING`,
        [id,disputeId,user.id,input.reason,input.note.trim(),input.latitude??null,input.longitude??null,input.accuracyMeters??null,input.locationCapturedAt??null,input.locationStatus],
      );
      await client.query("UPDATE deal SET dispute_previous_status=status,status='disputed',settlement_status=CASE WHEN settlement_status='settled' THEN settlement_status ELSE 'manual_review' END,updated_at=now() WHERE id=$1",[id]);
      await this.event(client,id,user.id,'delivery.confirmation_problem','arrived','disputed',{
        reason:input.reason,disputeId,locationStatus:input.locationStatus,accuracyMeters:input.accuracyMeters??null,
      });
      await this.audit(client,user,'delivery.confirmation_problem',id,{reason:input.reason,disputeId,locationStatus:input.locationStatus});
      await this.notifications.create({userId:deal.sender_id,type:'delivery.confirmation_problem',title:'Підтвердження доставки оскаржено',body:'Перевізник повідомив, що код доставки не вдалося отримати. Кошти заморожені до перевірки доказів.',entityType:'deal',entityId:id},client);
      await this.notifications.create({userId:deal.driver_id,type:'dispute.opened',title:'Відкрито перевірку доставки',body:'Фото та дані доставки зафіксовані. Додайте пояснення або докази у спорі.',entityType:'deal',entityId:id},client);
      return {deal:await this.getWithClient(client,user.id,id),disputeId,alreadyReported:false};
    });
  }

  async confirmDelivery(user: RequestUser, id: string, code: string) {
    const result = await this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client, user, id);
      if (deal.driver_id !== user.id) throw new ForbiddenException({ code: 'DELIVERY_DRIVER_ONLY', message: 'Only driver can confirm delivery' });
      if (deal.status === 'completed') return { deal: await this.getWithClient(client, user.id, id) };
      if (deal.status !== 'arrived') throw new ConflictException({ code: 'DELIVERY_STATE_INVALID', message: 'Driver must mark arrival before delivery confirmation' });
      await this.requireHandoverEvidence(client,id,'delivery');
      const sync=await client.query<any>(`SELECT count(*) FILTER(WHERE participant_role='driver')::int d,count(*) FILTER(WHERE participant_role='sender')::int s FROM deal_handover_evidence WHERE deal_id=$1 AND stage='delivery'`,[id]); if(!sync.rows[0]?.d||!sync.rows[0]?.s)throw new ConflictException({code:'HANDOVER_BOTH_EVIDENCE_REQUIRED',message:'Both participants must capture a delivery photo before code confirmation'});
      if (deal.delivery_locked_until && new Date(deal.delivery_locked_until).getTime() > Date.now()) {
        return { error: { code: 'DELIVERY_CODE_LOCKED', message: 'Too many incorrect delivery code attempts. Try later.' } };
      }
      if (!this.safeCodeHashEqual(code, deal.delivery_code_hash)) {
        const attempts = Number(deal.delivery_attempts ?? 0) + 1;
        const lock = attempts >= 5;
        await client.query(`UPDATE deal SET delivery_attempts=$2,delivery_locked_until=CASE WHEN $3 THEN now()+interval '5 minutes' ELSE NULL END,updated_at=now() WHERE id=$1`, [id, attempts, lock]);
        await this.event(client, id, user.id, 'delivery.code_failed', 'arrived', 'arrived', { attempts, locked: lock });
        return { error: { code: lock ? 'DELIVERY_CODE_LOCKED' : 'DELIVERY_CODE_INVALID', message: lock ? 'Too many incorrect delivery code attempts. Try later.' : 'Delivery code is incorrect' } };
      }

      await client.query(`UPDATE deal SET status='delivered',delivery_attempts=0,delivery_locked_until=NULL,delivery_verified_at=now(),delivery_code_hash=NULL,delivery_code_ciphertext=NULL,updated_at=now() WHERE id=$1`, [id]);
      await this.event(client, id, user.id, 'delivery.verified', 'arrived', 'delivered', {});

      await this.audit(client, user, 'delivery.verified', id, {});
      await this.notifications.create({userId:deal.sender_id,type:'delivery.verified',title:'Доставку підтверджено',body:'Код доставки підтверджено. Розпочато фінальний розрахунок.',entityType:'deal',entityId:id},client);
      await this.notifications.create({userId:deal.driver_id,type:'delivery.verified',title:'Доставку підтверджено',body:'Код доставки підтверджено. Розпочато фінальний розрахунок.',entityType:'deal',entityId:id},client);
      return { deal: await this.getWithClient(client, user.id, id) };
    });
    if ('error' in result) throw new ConflictException(result.error);
    await this.settlement.settleDeliveredDeal(id);
    return this.getMine(user,id);
  }

  async createReview(user: RequestUser, id: string, input: ReviewInput) {
    return this.db.transaction(async (client) => {
      const deal = await this.lockParticipantDeal(client, user, id);
      if (deal.status !== 'completed') throw new ConflictException({ code: 'REVIEW_TOO_EARLY', message: 'Deal must be completed before review' });
      const revieweeId = deal.sender_id === user.id ? deal.driver_id : deal.sender_id;
      const existing = await client.query<any>('SELECT * FROM deal_review WHERE deal_id=$1 AND reviewer_id=$2', [id, user.id]);
      if (existing.rows[0]) return this.reviewDto(existing.rows[0], user.id);
      const created = await client.query<any>(`INSERT INTO deal_review(deal_id,reviewer_id,reviewee_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING *`, [id, user.id, revieweeId, input.rating, input.comment?.trim() || null]);
      await this.audit(client, user, 'review.created', id, { revieweeId, rating: input.rating });
      return this.reviewDto(created.rows[0], user.id);
    });
  }

  async listReviews(user: RequestUser, id: string) {
    const deal = await this.db.query<any>('SELECT id,sender_id,driver_id FROM deal WHERE id=$1 AND (sender_id=$2 OR driver_id=$2)', [id, user.id]);
    if (!deal.rows[0]) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    const reviews = await this.db.query<any>(`SELECT r.*,reviewer.display_name AS reviewer_name,reviewee.display_name AS reviewee_name FROM deal_review r JOIN app_user reviewer ON reviewer.id=r.reviewer_id JOIN app_user reviewee ON reviewee.id=r.reviewee_id WHERE r.deal_id=$1 ORDER BY r.created_at ASC`, [id]);
    return reviews.rows.map((r: any) => ({ ...this.reviewDto(r, user.id), reviewerName: r.reviewer_name, revieweeName: r.reviewee_name }));
  }

  async listMine(user: RequestUser) {
    const r = await this.db.query<any>(this.select() + ` WHERE d.sender_id=$1 OR d.driver_id=$1 ORDER BY d.created_at DESC LIMIT 100`, [user.id]);
    return r.rows.map((x: any) => this.dto(x, user.id, false));
  }

  async getMine(user: RequestUser, id: string) {
    const r = await this.db.query<any>(this.select() + ` WHERE d.id=$1 AND (d.sender_id=$2 OR d.driver_id=$2)`, [id, user.id]);
    if (!r.rows[0]) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    const events = await this.db.query<any>('SELECT event_type,from_status,to_status,metadata,created_at FROM deal_event WHERE deal_id=$1 ORDER BY id ASC', [id]);
    const reviews = await this.db.query<any>('SELECT reviewer_id,reviewee_id,rating,comment,created_at FROM deal_review WHERE deal_id=$1 ORDER BY created_at ASC', [id]);
    const evidence = await this.db.query<any>('SELECT id,stage,mime_type,size_bytes,sha256_hex,note,server_captured_at,latitude,longitude,accuracy_meters,client_captured_at,location_status FROM deal_handover_evidence WHERE deal_id=$1 ORDER BY server_captured_at ASC', [id]);
    return {
      ...this.dto(r.rows[0], user.id, true),
      events: events.rows.map((e) => ({ type: e.event_type, fromStatus: e.from_status, toStatus: e.to_status, metadata: e.metadata, createdAt: e.created_at })),
      reviews: reviews.rows.map((review) => this.reviewDto(review, user.id)),
      handoverEvidence: evidence.rows.map((x:any)=>this.evidenceDto(x)),
    };
  }

  async cancelAwaitingPayment(user: RequestUser, id: string, reason: string) {
    return this.db.transaction(async (client) => {
      const r = await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [id]);
      const deal = r.rows[0];
      if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
      if (deal.sender_id !== user.id && deal.driver_id !== user.id) throw new ForbiddenException({ code: 'DEAL_FORBIDDEN', message: 'Not your deal' });
      if (deal.status === 'cancelled') return this.getWithClient(client, user.id, id);
      if (deal.status !== 'awaiting_payment') throw new ConflictException({ code: 'DEAL_NOT_CANCELLABLE', message: 'Only an unpaid deal can be cancelled directly' });
      await client.query("UPDATE deal SET status='cancelled',cancelled_by=$2,cancellation_reason=$3,updated_at=now() WHERE id=$1", [id, user.id, reason]);
      await client.query("UPDATE cargo SET status='published',updated_at=now() WHERE id=$1 AND status='matched'", [deal.cargo_id]);
      await client.query("UPDATE cargo_offer SET status='rejected',updated_at=now() WHERE id=$1 AND status='accepted'", [deal.offer_id]);
      await this.matching.recomputeCargo(client, deal.cargo_id);
      await this.event(client, id, user.id, 'deal.cancelled', 'awaiting_payment', 'cancelled', { reason });
      await this.audit(client, user, 'deal.cancelled', id, { reason });
      return this.getWithClient(client, user.id, id);
    });
  }

  private select() {
    return `SELECT d.*,c.title AS cargo_title,c.pickup_public_label,c.delivery_public_label,
      c.pickup_address_private,c.delivery_address_private,
      sender.display_name AS sender_name,driver.display_name AS driver_name,
      sender.phone_e164 AS sender_phone,driver.phone_e164 AS driver_phone,
      sender.verification_status AS sender_verification_status,driver.verification_status AS driver_verification_status,
      t.origin_public_label,t.destination_public_label,p.status AS payout_status,p.provider AS payout_provider,p.provider_reference AS payout_reference,p.paid_at AS payout_paid_at,
      (SELECT count(*)::int FROM deal_handover_evidence e WHERE e.deal_id=d.id AND e.stage='pickup') AS pickup_evidence_count,
      (SELECT count(*)::int FROM deal_handover_evidence e WHERE e.deal_id=d.id AND e.stage='delivery') AS delivery_evidence_count,
      (SELECT count(*)::int FROM deal_handover_evidence e WHERE e.deal_id=d.id AND e.stage='delivery' AND e.participant_role='driver') AS driver_delivery_evidence_count,
      (SELECT count(*)::int FROM deal_handover_evidence e WHERE e.deal_id=d.id AND e.stage='delivery' AND e.participant_role='sender') AS sender_delivery_evidence_count,
      hs.id AS handover_session_id,hs.driver_arrived_at AS hs_driver_arrived_at,hs.recipient_present_at AS hs_recipient_present_at,hs.started_at AS hs_started_at,hs.strong_window_seconds AS hs_window
      FROM deal d JOIN cargo c ON c.id=d.cargo_id JOIN trip t ON t.id=d.trip_id
      JOIN app_user sender ON sender.id=d.sender_id JOIN app_user driver ON driver.id=d.driver_id LEFT JOIN payout p ON p.deal_id=d.id LEFT JOIN deal_handover_session hs ON hs.deal_id=d.id`;
  }

  private dto(r: any, userId: string, includeCodes = true) {
    const isSender = r.sender_id === userId;
    const contactUnlocked = ['secured','captured','released'].includes(String(r.payment_status??''));
    const locationUnlocked = ['payment_secured','awaiting_pickup','picked_up','in_transit','arrived','delivered','completed','disputed'].includes(r.status);
    const pickupEvidenceCount = Number(r.pickup_evidence_count ?? 0);
    const deliveryEvidenceCount = Number(r.delivery_evidence_count ?? 0); const driverDeliveryCount=Number(r.driver_delivery_evidence_count??0); const senderDeliveryCount=Number(r.sender_delivery_evidence_count??0); const handoverStarted=!!r.hs_started_at;
    const pickupCode = includeCodes && isSender && r.status === 'awaiting_pickup' && pickupEvidenceCount > 0 && r.pickup_code_ciphertext ? this.decryptCode(r.pickup_code_ciphertext) : null;
    const deliveryCode = includeCodes && isSender && r.status === 'arrived' && driverDeliveryCount > 0 && senderDeliveryCount > 0 && r.delivery_code_ciphertext ? this.decryptCode(r.delivery_code_ciphertext) : null;
    const paymentMode = this.config.getOrThrow<string>('PAYMENTS_MODE');
    return {
      id: r.id, cargoId: r.cargo_id, tripId: r.trip_id, offerId: r.offer_id, role: isSender ? 'sender' : 'driver', status: r.status,
      paymentStatus: r.payment_status, paymentMode, agreedAmountMinor: Number(r.agreed_amount_minor), platformFeeMinor: Number(r.platform_fee_minor??0), carrierAmountMinor: Number(r.carrier_amount_minor??0), targetNetMarginMinor: Number(r.target_net_margin_minor??0), estimatedAcquiringFeeMinor: Number(r.estimated_acquiring_fee_minor??0), estimatedPayoutFeeMinor: Number(r.estimated_payout_fee_minor??0), actualAcquiringFeeMinor: r.actual_acquiring_fee_minor===null||r.actual_acquiring_fee_minor===undefined?null:Number(r.actual_acquiring_fee_minor), actualPayoutFeeMinor: r.actual_payout_fee_minor===null||r.actual_payout_fee_minor===undefined?null:Number(r.actual_payout_fee_minor), platformNetRevenueMinor: r.platform_net_revenue_minor===null||r.platform_net_revenue_minor===undefined?null:Number(r.platform_net_revenue_minor), actualNetMarginBps: r.actual_net_margin_bps===null||r.actual_net_margin_bps===undefined?null:Number(r.actual_net_margin_bps), feePolicy: r.fee_policy_snapshot??null, settlementStatus: r.settlement_status??'not_started', payoutStatus:r.payout_status??null, payoutProvider:r.payout_provider??null, payoutPaidAt:r.payout_paid_at??null, currency: r.currency, declaredValueMinor:r.declared_value_minor_snapshot==null?null:Number(r.declared_value_minor_snapshot), declaredValueCurrency:r.declared_value_currency_snapshot??null,
      cargo: { title: r.cargo_title, pickupLabel: r.pickup_public_label, deliveryLabel: r.delivery_public_label, privatePickupAddress: locationUnlocked ? r.pickup_address_private : null, privateDeliveryAddress: locationUnlocked ? r.delivery_address_private : null },
      sender: { displayName: r.sender_name, verificationStatus: r.sender_verification_status, phone: contactUnlocked ? r.sender_phone : null },
      driver: { displayName: r.driver_name, verificationStatus: r.driver_verification_status, phone: contactUnlocked ? r.driver_phone : null },
      contactsAvailable: contactUnlocked,
      trip: { originLabel: r.origin_public_label, destinationLabel: r.destination_public_label },
      privateLocationsAvailable: locationUnlocked,
      codes: { pickup: pickupCode, delivery: deliveryCode },
      evidenceSummary: { pickupCount: pickupEvidenceCount, deliveryCount: deliveryEvidenceCount, pickupReady: pickupEvidenceCount>0, deliveryReady: driverDeliveryCount>0&&senderDeliveryCount>0, driverDeliveryCount, senderDeliveryCount },
      handoverSession:{driverPresent:!!r.hs_driver_arrived_at,recipientPresent:!!r.hs_recipient_present_at,startedAt:r.hs_started_at??null,strongWindowSeconds:Number(r.hs_window??60)},
      actions: {
        canDevSecurePayment: isSender && r.status === 'awaiting_payment' && paymentMode === 'mock',
        canStartHostedPayment: isSender && r.status === 'awaiting_payment' && ['liqpay_sandbox','liqpay_production'].includes(paymentMode),
        canSyncHostedPayment: isSender && r.status === 'awaiting_payment' && ['liqpay_sandbox','liqpay_production'].includes(paymentMode),
        canCancel: r.status === 'awaiting_payment',
        canUploadPickupEvidence: !isSender && r.status === 'awaiting_pickup' && pickupEvidenceCount < 3,
        canConfirmPickup: !isSender && r.status === 'awaiting_pickup' && pickupEvidenceCount > 0,
        canStartTransit: !isSender && r.status === 'picked_up',
        canMarkArrived: !isSender && r.status === 'in_transit',
        canConfirmRecipientPresent: isSender&&r.status==='arrived'&&!r.hs_recipient_present_at,
        canStartHandover: !isSender&&r.status==='arrived'&&!!r.hs_driver_arrived_at&&!!r.hs_recipient_present_at&&!handoverStarted,
        canUploadDeliveryEvidence: r.status==='arrived'&&handoverStarted&&((isSender?senderDeliveryCount:driverDeliveryCount)<3),
        canConfirmDelivery: !isSender && r.status === 'arrived' && driverDeliveryCount > 0 && senderDeliveryCount > 0,
        canReportDeliveryProblem: !isSender && r.status === 'arrived' && deliveryEvidenceCount > 0,
        canReview: r.status === 'completed',
        canOpenDispute: ['payment_secured','awaiting_pickup','picked_up','in_transit','arrived','delivered','disputed'].includes(r.status),
      },
      timestamps: {
        paymentSecuredAt: r.payment_secured_at, pickupVerifiedAt: r.pickup_verified_at, transitStartedAt: r.transit_started_at,
        arrivedAt: r.arrived_at, deliveryVerifiedAt: r.delivery_verified_at, completedAt: r.completed_at,
      },
      createdAt: r.created_at, updatedAt: r.updated_at, cancellationReason: r.cancellation_reason,
    };
  }

  private evidenceDto(x:any) { return {
    id:x.id, stage:x.stage, mimeType:x.mime_type, sizeBytes:Number(x.size_bytes), sha256:x.sha256_hex, note:x.note??null,
    capturedAt:x.server_captured_at, participantRole:x.participant_role??null, synchronizationGrade:x.synchronization_grade??null,
    location: x.latitude===null||x.latitude===undefined||x.longitude===null||x.longitude===undefined ? null : {
      latitude:Number(x.latitude), longitude:Number(x.longitude),
      accuracyMeters:x.accuracy_meters===null||x.accuracy_meters===undefined?null:Number(x.accuracy_meters),
      clientCapturedAt:x.client_captured_at??null,
    },
    locationStatus:x.location_status??'unavailable',
  }; }

  private async lockParticipantDeal(client: PoolClient, user: RequestUser, id: string) {
    const r = await client.query<any>('SELECT * FROM deal WHERE id=$1 FOR UPDATE', [id]);
    const deal = r.rows[0];
    if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    if (deal.sender_id !== user.id && deal.driver_id !== user.id) throw new ForbiddenException({ code: 'DEAL_FORBIDDEN', message: 'Not your deal' });
    return deal;
  }

  private async getWithClient(client: PoolClient, userId: string, id: string) {
    const r = await client.query<any>(this.select() + ` WHERE d.id=$1 AND (d.sender_id=$2 OR d.driver_id=$2)`, [id, userId]);
    if (!r.rows[0]) throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    return this.dto(r.rows[0], userId);
  }

  private generateCode() { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }

  private codeKey() {
    return createHash('sha256').update(this.config.getOrThrow<string>('DEAL_CODE_SECRET')).digest();
  }

  private codeHash(code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('DEAL_CODE_SECRET')).update(`verify:${code}`).digest('hex');
  }

  private safeCodeHashEqual(code: string, storedHash: string | null | undefined) {
    if (!storedHash) return false;
    const actual = Buffer.from(this.codeHash(code), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private encryptCode(code: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.codeKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
  }

  private decryptCode(value: string) {
    const [version, ivValue, tagValue, dataValue] = value.split(':');
    if (version !== 'v1' || !ivValue || !tagValue || !dataValue) throw new Error('Unsupported deal code ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', this.codeKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataValue, 'base64url')), decipher.final()]).toString('utf8');
  }

  private reviewDto(r: any, userId: string) {
    return { dealId: r.deal_id, rating: Number(r.rating), comment: r.comment, isMine: r.reviewer_id === userId, createdAt: r.created_at };
  }

  private async event(client: PoolClient, dealId: string, actor: string | null, type: string, from: string | null, to: string | null, metadata: object) {
    await client.query(`INSERT INTO deal_event(deal_id,actor_user_id,event_type,from_status,to_status,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [dealId, actor, type, from, to, JSON.stringify(metadata)]);
  }

  private async audit(client: PoolClient, user: RequestUser, eventType: string, entityId: string, metadata: object) {
    await client.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,'deal',$4,$5::jsonb)`, [user.id, user.sessionId, eventType, entityId, JSON.stringify(metadata)]);
  }
}
