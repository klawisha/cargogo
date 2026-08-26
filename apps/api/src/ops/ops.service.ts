import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from '../legal/legal.documents';

@Injectable()
export class OpsService{
 constructor(private readonly db:DatabaseService,private readonly config:ConfigService){}
 async reportClientError(user:RequestUser,input:any){const message=String(input?.message??'').slice(0,2000);if(!message)return{ok:false};await this.db.query(`INSERT INTO client_error_event(user_id,session_id,app_version,platform,screen,error_name,message,stack,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,[user.id,user.sessionId,String(input?.appVersion??'').slice(0,80)||null,String(input?.platform??'').slice(0,30)||null,String(input?.screen??'').slice(0,200)||null,String(input?.errorName??'').slice(0,120)||null,message,String(input?.stack??'').slice(0,10000)||null,JSON.stringify(input?.metadata??{})]);return{ok:true}}
 private assertStaff(user:RequestUser){if(!['reviewer','admin'].includes(user.staffRole??''))throw new ForbiddenException({code:'OPS_STAFF_REQUIRED',message:'Reviewer/admin required'})}
 async readiness(user:RequestUser){this.assertStaff(user);
  const [funnel,audit,errors,push,legal,privacy]=await Promise.all([
   this.db.query<any>(`SELECT (SELECT count(*) FROM app_user)::int users,(SELECT count(*) FROM app_user WHERE verification_status='verified')::int verified,(SELECT count(*) FROM cargo)::int cargo,(SELECT count(*) FROM trip)::int trips,(SELECT count(*) FROM cargo_offer)::int offers,(SELECT count(*) FROM deal)::int deals,(SELECT count(*) FROM deal WHERE status='completed')::int completed`),
   this.db.query<any>(`SELECT a.id,a.event_type AS "eventType",a.entity_type AS "entityType",a.entity_id AS "entityId",a.metadata,a.created_at AS "createdAt",u.display_name AS "actorName" FROM audit_event a LEFT JOIN app_user u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 40`),
   this.db.query<any>(`SELECT count(*) FILTER(WHERE created_at>=now()-interval '24 hours')::int errors24h,count(*) FILTER(WHERE created_at>=now()-interval '7 days')::int errors7d FROM client_error_event`),
   this.db.query<any>(`SELECT count(*) FILTER(WHERE delivered_at IS NULL AND attempts<5)::int pending,count(*) FILTER(WHERE delivered_at IS NULL AND attempts>=5)::int failed FROM push_delivery_outbox`),
   this.db.query<any>(`SELECT document_key,count(*)::int acceptances FROM legal_acceptance WHERE document_version=$1 GROUP BY document_key`,[LEGAL_VERSION]),
   this.db.query<any>(`SELECT count(*) FILTER(WHERE status IN('open','in_review'))::int open FROM privacy_request`)
  ]);
  const env={nodeEnv:this.config.get('NODE_ENV'),paymentsMode:this.config.get('PAYMENTS_MODE'),payoutsMode:this.config.get('PAYOUTS_MODE'),kycMode:this.config.get('KYC_MODE'),verificationEnforcement:this.config.get('VERIFICATION_ENFORCEMENT'),publicBaseUrl:this.config.get('PUBLIC_BASE_URL'),routingProvider:this.config.get('ROUTING_PROVIDER'),mapboxConfigured:!!this.config.get('MAPBOX_ACCESS_TOKEN')};
  const f=funnel.rows[0]??{};const checks=[
   {key:'db',label:'Database/schema',status:'pass',detail:'API responded and readiness query succeeded'},
   {key:'verification',label:'Verification enforcement',status:env.verificationEnforcement==='on'?'pass':'fail',detail:env.verificationEnforcement==='on'?'on · shipper/driver verification enforced':'off · API environment override detected'},
   {key:'routing',label:'Road routing',status:env.mapboxConfigured?'pass':'warn',detail:env.mapboxConfigured?'Mapbox token configured':'Mapbox token missing'},
   {key:'payments',label:'Payments',status:env.paymentsMode==='mock'?'warn':'pass',detail:String(env.paymentsMode)},
   {key:'payouts',label:'Payouts',status:env.payoutsMode==='sandbox'?'warn':'pass',detail:String(env.payoutsMode)},
   {key:'kyc',label:'KYC mode',status:env.kycMode==='mock'?'warn':'pass',detail:String(env.kycMode)},
   {key:'legal',label:'Legal package',status:LEGAL_DOCUMENTS.length>=8?'pass':'fail',detail:`${LEGAL_DOCUMENTS.length} versioned documents · ${LEGAL_VERSION}`},
   {key:'push',label:'Push outbox',status:Number(push.rows[0]?.failed??0)>0?'warn':'pass',detail:`${Number(push.rows[0]?.pending??0)} pending · ${Number(push.rows[0]?.failed??0)} failed`},
   {key:'client-errors',label:'Client errors 24h',status:Number(errors.rows[0]?.errors24h??0)>10?'warn':'pass',detail:String(Number(errors.rows[0]?.errors24h??0))},
  ];
  return {generatedAt:new Date().toISOString(),env,checks,funnel:{users:Number(f.users??0),verified:Number(f.verified??0),cargo:Number(f.cargo??0),trips:Number(f.trips??0),offers:Number(f.offers??0),deals:Number(f.deals??0),completed:Number(f.completed??0)},errors:errors.rows[0],push:push.rows[0],legal:{version:LEGAL_VERSION,documents:LEGAL_DOCUMENTS.length,acceptances:legal.rows},privacy:{open:Number(privacy.rows[0]?.open??0)},audit:audit.rows};
 }
}
