import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

@Injectable()
export class UsersService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,@Inject(ConfigService) private readonly config:ConfigService) {}
  private normalizeEmail(v:string){return v.trim().toLowerCase()}
  private normalizePhone(value:string){const raw=value.trim().replace(/[\s()\-]/g,'');if(/^0\d{9}$/.test(raw))return `+380${raw.slice(1)}`;if(/^380\d{9}$/.test(raw))return `+${raw}`;if(/^\+\d{8,15}$/.test(raw))return raw;throw new ConflictException({code:'PHONE_INVALID',message:'Вкажіть коректний номер телефону'});}
  private codeHash(userId:string,id:string,code:string){return createHash('sha256').update(`${userId}:${id}:${code}:cargogo-contact-v1`).digest('hex')}

  async profile(user: RequestUser) {
    const [stats,contacts]=await Promise.all([
      this.db.query<{ completed_count: string; review_count: string; rating_avg: string | null }>(`SELECT (SELECT COUNT(*)::text FROM deal d WHERE d.status='completed' AND (d.sender_id=$1 OR d.driver_id=$1)) AS completed_count,(SELECT COUNT(*)::text FROM deal_review r WHERE r.reviewee_id=$1) AS review_count,(SELECT ROUND(AVG(r.rating)::numeric,2)::text FROM deal_review r WHERE r.reviewee_id=$1) AS rating_avg`,[user.id]),
      this.db.query<any>(`SELECT email,email_verified_at,phone_e164,phone_verified_at,backup_phone_e164,backup_phone_verified_at,backup_email,backup_email_verified_at FROM app_user WHERE id=$1`,[user.id])
    ]);
    const row=stats.rows[0],c=contacts.rows[0]??{};
    return {id:user.id,displayName:user.displayName,email:user.email,phone:user.phone,status:user.status,verification:{status:user.verificationStatus,provider:null,verifiedAt:null},reputation:{completedDeals:Number(row?.completed_count??0),reviewCount:Number(row?.review_count??0),rating:row?.rating_avg===null?null:Number(row?.rating_avg)},contacts:{primaryPhone:{value:c.phone_e164,verified:!!c.phone_verified_at},primaryEmail:{value:c.email,verified:!!c.email_verified_at},backupPhone:{value:c.backup_phone_e164,verified:!!c.backup_phone_verified_at},backupEmail:{value:c.backup_email,verified:!!c.backup_email_verified_at}}};
  }

  async requestContactVerification(user:RequestUser,input:{kind:'primary_phone'|'primary_email'|'backup_email'|'backup_phone';value:string}){
    const phoneKind=input.kind==='primary_phone'||input.kind==='backup_phone';const value=phoneKind?this.normalizePhone(input.value):this.normalizeEmail(input.value);
    if(!phoneKind&&!/^\S+@\S+\.\S+$/.test(value))throw new ConflictException({code:'EMAIL_INVALID',message:'Вкажіть коректний email'});
    const duplicate=await this.db.query(`SELECT 1 FROM app_user WHERE id<>$1 AND (phone_e164=$2 OR backup_phone_e164=$2 OR lower(email)=$3 OR lower(backup_email)=$3) LIMIT 1`,[user.id,phoneKind?value:null,phoneKind?null:value]);
    if(duplicate.rowCount)throw new ConflictException({code:'CONTACT_IN_USE',message:'Цей контакт вже використовується іншим акаунтом'});
    const code=String(randomInt(0,1_000_000)).padStart(6,'0');
    const draft=await this.db.query<{id:string}>(`INSERT INTO contact_verification_challenge(user_id,kind,value,code_hash,expires_at) VALUES($1,$2,$3,'pending',now()+interval '10 minutes') RETURNING id`,[user.id,input.kind,value]);
    const id=draft.rows[0].id;await this.db.query('UPDATE contact_verification_challenge SET code_hash=$2 WHERE id=$1',[id,this.codeHash(user.id,id,code)]);
    await this.db.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'contact.verification_requested','contact',$3,$4::jsonb)`,[user.id,user.sessionId,id,JSON.stringify({kind:input.kind})]);
    const development=this.config.get<string>('NODE_ENV')!=='production';
    if(!development)throw new ForbiddenException({code:'CONTACT_DELIVERY_PROVIDER_REQUIRED',message:'SMS/email delivery provider must be configured before production contact verification'});
    return {challengeId:id,expiresInSeconds:600,delivery:'development',devCode:code};
  }

  async confirmContactVerification(user:RequestUser,input:{challengeId:string;code:string}){
    return this.db.transaction(async c=>{const r=await c.query<any>(`SELECT * FROM contact_verification_challenge WHERE id=$1 AND user_id=$2 FOR UPDATE`,[input.challengeId,user.id]);const ch=r.rows[0];if(!ch)throw new NotFoundException({code:'CHALLENGE_NOT_FOUND',message:'Код підтвердження не знайдено'});if(ch.consumed_at||new Date(ch.expires_at).getTime()<Date.now())throw new ConflictException({code:'CHALLENGE_EXPIRED',message:'Код вже недійсний'});if(Number(ch.attempts)>=5)throw new ConflictException({code:'TOO_MANY_ATTEMPTS',message:'Забагато спроб. Запросіть новий код'});if(this.codeHash(user.id,ch.id,input.code)!==ch.code_hash){await c.query('UPDATE contact_verification_challenge SET attempts=attempts+1 WHERE id=$1',[ch.id]);throw new ConflictException({code:'CODE_INVALID',message:'Невірний код'});}if(ch.kind==='primary_phone')await c.query('UPDATE app_user SET phone_e164=$2,phone_verified_at=now(),updated_at=now() WHERE id=$1',[user.id,ch.value]);if(ch.kind==='primary_email')await c.query('UPDATE app_user SET email=$2,email_verified_at=now(),updated_at=now() WHERE id=$1',[user.id,ch.value]);if(ch.kind==='backup_email')await c.query('UPDATE app_user SET backup_email=$2,backup_email_verified_at=now(),updated_at=now() WHERE id=$1',[user.id,ch.value]);if(ch.kind==='backup_phone')await c.query('UPDATE app_user SET backup_phone_e164=$2,backup_phone_verified_at=now(),updated_at=now() WHERE id=$1',[user.id,ch.value]);await c.query('UPDATE contact_verification_challenge SET consumed_at=now(),attempts=attempts+1 WHERE id=$1',[ch.id]);await c.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'contact.verified','contact',$3,$4::jsonb)`,[user.id,user.sessionId,ch.id,JSON.stringify({kind:ch.kind})]);return {ok:true,kind:ch.kind,value:ch.value};});
  }
}
