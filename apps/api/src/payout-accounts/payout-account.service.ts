import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

type Input={holderName:string;iban:string};
@Injectable()
export class PayoutAccountService {
  constructor(@Inject(DatabaseService) private readonly db:DatabaseService,@Inject(ConfigService) private readonly config:ConfigService){}
  async getMine(user:RequestUser){
    const r=await this.db.query<any>("SELECT * FROM payout_account WHERE user_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 1",[user.id]);
    return r.rows[0]?this.dto(r.rows[0]):null;
  }
  async requireActive(userId:string,client?:any){
    const q=client??this.db;
    const r=await q.query("SELECT * FROM payout_account WHERE user_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 1",[userId]);
    if(!r.rows[0]) throw new BadRequestException({code:'PAYOUT_ACCOUNT_REQUIRED',message:'Carrier must configure payout details before a deal can be accepted'});
    return r.rows[0];
  }
  async upsert(user:RequestUser,input:Input){
    const iban=input.iban.replace(/\s+/g,'').toUpperCase();
    if(!/^UA\d{27}$/.test(iban)) throw new BadRequestException({code:'IBAN_INVALID',message:'Invalid Ukrainian IBAN'});
    return this.db.transaction(async client=>{
      await client.query("UPDATE payout_account SET status='disabled',updated_at=now() WHERE user_id=$1 AND status='active'",[user.id]);
      const r=await client.query<any>(`INSERT INTO payout_account(user_id,holder_name_ciphertext,iban_ciphertext,iban_last4) VALUES($1,$2,$3,$4) RETURNING *`,[user.id,this.encrypt(input.holderName.trim()),this.encrypt(iban),iban.slice(-4)]);
      await client.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'payout_account.updated','payout_account',$3,'{}'::jsonb)`,[user.id,user.sessionId,r.rows[0].id]);
      return this.dto(r.rows[0]);
    });
  }
  async disable(user:RequestUser){
    const r=await this.db.query<any>("UPDATE payout_account SET status='disabled',updated_at=now() WHERE user_id=$1 AND status='active' RETURNING id",[user.id]);
    if(!r.rows[0]) throw new NotFoundException({code:'PAYOUT_ACCOUNT_NOT_FOUND',message:'No active payout account'});
    return {ok:true};
  }
  decryptForProvider(row:any){return {holderName:this.decrypt(row.holder_name_ciphertext),iban:this.decrypt(row.iban_ciphertext)};}
  private dto(r:any){return {id:r.id,provider:r.provider,methodType:r.method_type,maskedIban:`UA•••••••••••••••••••••${r.iban_last4}`,countryCode:r.country_code,currency:r.currency,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at};}
  private key(){return createHash('sha256').update(this.config.getOrThrow<string>('PAYOUT_DATA_SECRET')).digest();}
  private encrypt(v:string){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',this.key(),iv);const data=Buffer.concat([c.update(v,'utf8'),c.final()]);return `v1:${iv.toString('base64url')}:${c.getAuthTag().toString('base64url')}:${data.toString('base64url')}`;}
  private decrypt(v:string){const [ver,iv,tag,data]=v.split(':');if(ver!=='v1'||!iv||!tag||!data)throw new Error('Unsupported payout ciphertext');const d=createDecipheriv('aes-256-gcm',this.key(),Buffer.from(iv,'base64url'));d.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([d.update(Buffer.from(data,'base64url')),d.final()]).toString('utf8');}
}
