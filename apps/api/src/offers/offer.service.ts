import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import type { CreateOfferInput } from './offer.schemas';
import { NotificationService } from '../notifications/notification.service';
import { PayoutAccountService } from '../payout-accounts/payout-account.service';
import { VerificationService } from '../verification/verification.service';
import { CarrierModeService } from '../carrier-mode/carrier-mode.service';

@Injectable()
export class OfferService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService, private readonly notifications: NotificationService, private readonly payoutAccounts:PayoutAccountService, private readonly verification:VerificationService, private readonly carrierMode:CarrierModeService) {}

  async createOrReplace(user: RequestUser, input: CreateOfferInput) {
    return this.db.transaction(async (client) => {
      // Lock order is cargo -> trip everywhere in marketplace write paths to reduce deadlock risk.
      const cargo = await client.query<{ id:string; owner_id:string; status:string; currency:string }>(
        `SELECT id,owner_id,status,currency FROM cargo WHERE id=$1 FOR UPDATE`, [input.cargoId],
      );
      if (!cargo.rows[0]) throw new NotFoundException({ code:'CARGO_NOT_FOUND', message:'Cargo not found' });
      if (cargo.rows[0].owner_id === user.id) throw new ConflictException({ code:'OWN_CARGO', message:'You cannot offer on your own cargo' });
      if (cargo.rows[0].status !== 'published') throw new ConflictException({ code:'CARGO_NOT_AVAILABLE', message:'Cargo is no longer available' });
      if (cargo.rows[0].currency !== input.currency) throw new ConflictException({ code:'CURRENCY_MISMATCH', message:'Offer currency must match cargo currency' });

      const trip = await client.query<{ id:string; driver_id:string; status:string; vehicle_id:string }>(
        `SELECT id,driver_id,status,vehicle_id FROM trip WHERE id=$1 FOR UPDATE`, [input.tripId],
      );
      if (!trip.rows[0]) throw new NotFoundException({ code:'TRIP_NOT_FOUND', message:'Trip not found' });
      if (trip.rows[0].driver_id !== user.id) throw new ForbiddenException({ code:'TRIP_FORBIDDEN', message:'Not your trip' });
      if (trip.rows[0].status !== 'published') throw new ConflictException({ code:'TRIP_NOT_AVAILABLE', message:'Trip is not accepting cargo' });
      await this.verification.assertDriverReady(user.id,trip.rows[0].vehicle_id,client);

      const matched = await client.query('SELECT 1 FROM trip_match WHERE trip_id=$1 AND cargo_id=$2 LIMIT 1', [input.tripId,input.cargoId]);
      if (!matched.rowCount) throw new ForbiddenException({ code:'MATCH_REQUIRED', message:'Cargo is not an eligible match for this trip' });

      const carrierPolicy=await this.carrierMode.assertOfferAllowed(user.id,input.tripId,input.cargoId,input.amountMinor,client);const carrierMode=carrierPolicy.mode;
      await this.payoutAccounts.requireActive(user.id, client);

      const existing = await client.query<{ id:string }>(
        `SELECT id FROM cargo_offer WHERE cargo_id=$1 AND trip_id=$2 AND driver_id=$3 AND status='pending' FOR UPDATE`,
        [input.cargoId,input.tripId,user.id],
      );

      let offerId: string;
      if (existing.rows[0]) {
        offerId = existing.rows[0].id;
        await client.query(`UPDATE cargo_offer SET amount_minor=$2,message=$3,carrier_mode_snapshot=$4,expires_at=now()+interval '48 hours',updated_at=now() WHERE id=$1`,
          [offerId,input.amountMinor,input.message ?? null,carrierMode]);
        await this.audit(client,user,'offer.updated',offerId,{ cargoId:input.cargoId, tripId:input.tripId, amountMinor:input.amountMinor });
      } else {
        const inserted = await client.query<{ id:string }>(`INSERT INTO cargo_offer(cargo_id,trip_id,cargo_owner_id,driver_id,amount_minor,currency,message,carrier_mode_snapshot)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [input.cargoId,input.tripId,cargo.rows[0].owner_id,user.id,input.amountMinor,input.currency,input.message ?? null,carrierMode]);
        offerId = inserted.rows[0].id;
        await this.audit(client,user,'offer.created',offerId,{ cargoId:input.cargoId, tripId:input.tripId, amountMinor:input.amountMinor });
      }
      await this.notifications.create({ userId:cargo.rows[0].owner_id, type:'offer.received', title:'Нова пропозиція', body:`Перевізник запропонував ${Math.round(input.amountMinor/100)} ${input.currency} за ваш вантаж.`, entityType:'offer', entityId:offerId, metadata:{cargoId:input.cargoId,tripId:input.tripId} }, client);
      return this.getForParticipantWithClient(client,user.id,offerId);
    });
  }

  async listSent(user: RequestUser) {
    await this.db.query("UPDATE cargo_offer SET status='expired',updated_at=now() WHERE driver_id=$1 AND status='pending' AND expires_at<=now()",[user.id]);
    const result = await this.db.query(this.offerSelect()+` WHERE o.driver_id=$1 ORDER BY o.created_at DESC LIMIT 100`,[user.id]);
    return result.rows.map(this.toDto);
  }

  async listForCargo(user: RequestUser, cargoId: string) {
    const cargo = await this.db.query<{ owner_id:string }>('SELECT owner_id FROM cargo WHERE id=$1',[cargoId]);
    if (!cargo.rows[0]) throw new NotFoundException({ code:'CARGO_NOT_FOUND', message:'Cargo not found' });
    if (cargo.rows[0].owner_id !== user.id) throw new ForbiddenException({ code:'CARGO_FORBIDDEN', message:'Not your cargo' });
    await this.db.query("UPDATE cargo_offer SET status='expired',updated_at=now() WHERE cargo_id=$1 AND status='pending' AND expires_at<=now()",[cargoId]);
    const result = await this.db.query(this.offerSelect()+` WHERE o.cargo_id=$1 ORDER BY CASE o.status WHEN 'pending' THEN 0 ELSE 1 END,o.created_at DESC`,[cargoId]);
    return result.rows.map(this.toDto);
  }

  async withdraw(user: RequestUser, offerId: string) {
    return this.db.transaction(async (client) => {
      const offer = await client.query<any>('SELECT * FROM cargo_offer WHERE id=$1 FOR UPDATE',[offerId]);
      const row=offer.rows[0];
      if (!row) throw new NotFoundException({code:'OFFER_NOT_FOUND',message:'Offer not found'});
      if (row.driver_id!==user.id) throw new ForbiddenException({code:'OFFER_FORBIDDEN',message:'Not your offer'});
      if (row.status!=='pending') throw new ConflictException({code:'OFFER_NOT_PENDING',message:'Only pending offers can be withdrawn'});
      await client.query("UPDATE cargo_offer SET status='withdrawn',updated_at=now() WHERE id=$1",[offerId]);
      await this.audit(client,user,'offer.withdrawn',offerId,{});
      await this.notifications.create({userId:row.cargo_owner_id,type:'offer.withdrawn',title:'Пропозицію відкликано',body:'Перевізник відкликав свою пропозицію.',entityType:'offer',entityId:offerId},client);
      return this.getForParticipantWithClient(client,user.id,offerId);
    });
  }

  async reject(user: RequestUser, offerId: string) {
    return this.db.transaction(async (client) => {
      const offer = await client.query<any>('SELECT * FROM cargo_offer WHERE id=$1 FOR UPDATE',[offerId]);
      const row=offer.rows[0];
      if (!row) throw new NotFoundException({code:'OFFER_NOT_FOUND',message:'Offer not found'});
      if (row.cargo_owner_id!==user.id) throw new ForbiddenException({code:'OFFER_FORBIDDEN',message:'Not your cargo offer'});
      if (row.status!=='pending') throw new ConflictException({code:'OFFER_NOT_PENDING',message:'Only pending offers can be rejected'});
      await client.query("UPDATE cargo_offer SET status='rejected',updated_at=now() WHERE id=$1",[offerId]);
      await this.audit(client,user,'offer.rejected',offerId,{});
      await this.notifications.create({userId:row.driver_id,type:'offer.rejected',title:'Пропозицію відхилено',body:'Власник вантажу відхилив вашу пропозицію.',entityType:'offer',entityId:offerId},client);
      return this.getForParticipantWithClient(client,user.id,offerId);
    });
  }

  private offerSelect(){return `SELECT o.id,o.cargo_id,o.trip_id,o.cargo_owner_id,o.driver_id,o.amount_minor,o.currency,o.message,o.status,o.expires_at,o.created_at,o.updated_at,
    c.title AS cargo_title,c.pickup_public_label,c.delivery_public_label,
    u.display_name AS driver_name,u.verification_status AS driver_verification_status
    FROM cargo_offer o JOIN cargo c ON c.id=o.cargo_id JOIN app_user u ON u.id=o.driver_id`;}
  private toDto=(r:any)=>({id:r.id,cargoId:r.cargo_id,tripId:r.trip_id,amountMinor:r.amount_minor,currency:r.currency,message:r.message,status:r.status,
    expiresAt:r.expires_at,createdAt:r.created_at,updatedAt:r.updated_at,cargo:{title:r.cargo_title,pickupLabel:r.pickup_public_label,deliveryLabel:r.delivery_public_label},
    driver:{displayName:r.driver_name,verificationStatus:r.driver_verification_status}});
  private async getForParticipantWithClient(client:PoolClient,userId:string,id:string){const r=await client.query<any>(this.offerSelect()+` WHERE o.id=$1 AND (o.driver_id=$2 OR o.cargo_owner_id=$2)`,[id,userId]);if(!r.rows[0])throw new NotFoundException({code:'OFFER_NOT_FOUND',message:'Offer not found'});return this.toDto(r.rows[0]);}
  private async audit(client:PoolClient,user:RequestUser,eventType:string,entityId:string,metadata:object){await client.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,'offer',$4,$5::jsonb)`,[user.id,user.sessionId,eventType,entityId,JSON.stringify(metadata)]);}
}
