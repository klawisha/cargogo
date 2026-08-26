import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from './legal.documents';

@Injectable()
export class LegalService {
  constructor(private readonly db:DatabaseService,private readonly config:ConfigService){}
  private render(content:string){const values:Record<string,string>={
    OPERATOR_LEGAL_NAME:this.config.get('LEGAL_OPERATOR_NAME')??'[Оператор буде вказаний до production]',
    OPERATOR_TAX_ID:this.config.get('LEGAL_OPERATOR_TAX_ID')??'[РНОКПП/ЄДРПОУ]',
    OPERATOR_ADDRESS:this.config.get('LEGAL_OPERATOR_ADDRESS')??'[Адреса для листування]',
    LEGAL_EMAIL:this.config.get('LEGAL_EMAIL')??'[legal email]',
    PRIVACY_EMAIL:this.config.get('PRIVACY_EMAIL')??'[privacy email]',
  };return content.replace(/\{\{([A-Z0-9_]+)\}\}/g,(_,k)=>values[k]??`[${k}]`)}
  list(){return LEGAL_DOCUMENTS.map(({content,...x})=>{const rendered=this.render(content);return {...x,summary:rendered.split('\n').filter(x=>x&&!x.startsWith('#')&&!x.startsWith('>'))[0]?.slice(0,220)??''}});}
  get(key:string){const d=LEGAL_DOCUMENTS.find(x=>x.key===key);if(!d)throw new NotFoundException({code:'LEGAL_DOCUMENT_NOT_FOUND',message:'Legal document not found'});return {...d,content:this.render(d.content)};}
  async status(user:RequestUser){const r=await this.db.query<any>('SELECT document_key,document_version,accepted_at FROM legal_acceptance WHERE user_id=$1 ORDER BY accepted_at DESC',[user.id]);const latest=new Map<string,any>();for(const x of r.rows)if(!latest.has(x.document_key))latest.set(x.document_key,x);return {currentVersion:LEGAL_VERSION,required:['terms-of-use','privacy-policy'],accepted:[...latest.values()].map(x=>({key:x.document_key,version:x.document_version,acceptedAt:x.accepted_at})),currentRequiredAccepted:['terms-of-use','privacy-policy'].every(k=>latest.get(k)?.document_version===LEGAL_VERSION)};}
  async accept(user:RequestUser,key:string,version:string,meta:{ip?:string;userAgent?:string}){const d=this.get(key);if(version!==d.version)throw new BadRequestException({code:'LEGAL_VERSION_STALE',message:'Please review the current document version'});await this.db.query(`INSERT INTO legal_acceptance(user_id,document_key,document_version,ip,user_agent) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,document_key,document_version) DO NOTHING`,[user.id,key,version,meta.ip??null,meta.userAgent??null]);await this.db.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,metadata) VALUES($1,$2,'legal.accepted','legal_document',$3::jsonb)`,[user.id,user.sessionId,JSON.stringify({key,version})]);return {ok:true,key,version};}
  async createPrivacyRequest(user:RequestUser,type:string,note?:string,details?:unknown){
    const allowed=['access','correction','deletion','restriction','objection','consent_withdrawal'];
    if(!allowed.includes(type))throw new BadRequestException({code:'PRIVACY_REQUEST_TYPE_INVALID',message:'Unsupported privacy request'});
    const payload=this.validatePrivacyPayload(type,details);
    const open=await this.db.query<any>("SELECT id,status FROM privacy_request WHERE user_id=$1 AND request_type=$2 AND status IN ('open','in_review') LIMIT 1",[user.id,type]);
    if(open.rows[0])return {id:open.rows[0].id,status:open.rows[0].status,existing:true};
    const r=await this.db.query<any>('INSERT INTO privacy_request(user_id,request_type,note,request_payload) VALUES($1,$2,$3,$4::jsonb) RETURNING id,status,created_at AS "createdAt"',[user.id,type,note?.trim()||null,JSON.stringify(payload)]);
    await this.db.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,'privacy.requested','privacy_request',$3,$4::jsonb)`,[user.id,user.sessionId,r.rows[0].id,JSON.stringify({type,payloadKeys:Object.keys(payload)})]);
    return r.rows[0];
  }
  private validatePrivacyPayload(type:string,details:unknown){
    const x=(details&&typeof details==='object'&&!Array.isArray(details)?details:{}) as Record<string,unknown>;
    const clean=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
    if(type==='access'){const scope=clean(x.scope,1000);if(!scope)throw new BadRequestException({code:'PRIVACY_ACCESS_SCOPE_REQUIRED',message:'Describe which data you want to receive'});return{scope,details:clean(x.details),delivery:'in_app'};}
    if(type==='correction'){const currentValue=clean(x.currentValue,1000),requestedValue=clean(x.requestedValue,1000);if(!currentValue||!requestedValue)throw new BadRequestException({code:'PRIVACY_CORRECTION_DETAILS_REQUIRED',message:'Current and requested values are required'});return{currentValue,requestedValue,reason:clean(x.reason)};}
    if(type==='restriction'){const scope=clean(x.scope,1000),reason=clean(x.reason);if(!scope||!reason)throw new BadRequestException({code:'PRIVACY_RESTRICTION_DETAILS_REQUIRED',message:'Restriction scope and reason are required'});return{scope,reason};}
    if(type==='deletion'){if(x.confirmed!==true)throw new BadRequestException({code:'PRIVACY_DELETION_CONFIRMATION_REQUIRED',message:'Deletion request must be explicitly confirmed'});return{reason:clean(x.reason),confirmed:true};}
    return Object.fromEntries(Object.entries(x).slice(0,12).map(([k,v])=>[k,typeof v==='string'?clean(v):v]));
  }
  async myPrivacyRequests(user:RequestUser){const r=await this.db.query<any>('SELECT id,request_type AS "requestType",status,note,request_payload AS "requestPayload",reviewer_note AS "reviewerNote",created_at AS "createdAt",resolved_at AS "resolvedAt" FROM privacy_request WHERE user_id=$1 ORDER BY created_at DESC',[user.id]);return r.rows;}
  async staffPrivacyRequests(user:RequestUser){if(!['reviewer','admin'].includes(user.staffRole??''))throw new ForbiddenException({code:'STAFF_REQUIRED',message:'Reviewer/admin required'});const r=await this.db.query<any>(`SELECT p.id,p.request_type AS "requestType",p.status,p.note,p.request_payload AS "requestPayload",p.reviewer_note AS "reviewerNote",p.created_at AS "createdAt",u.display_name AS "displayName",u.phone_e164 AS phone FROM privacy_request p JOIN app_user u ON u.id=p.user_id WHERE p.status IN ('open','in_review') ORDER BY CASE WHEN p.status='in_review' THEN 0 ELSE 1 END,p.created_at ASC LIMIT 100`);return r.rows;}
  async updatePrivacyRequest(user:RequestUser,id:string,status:'in_review'|'completed'|'rejected',reviewerNote:string){
    if(!['reviewer','admin'].includes(user.staffRole??''))throw new ForbiddenException({code:'STAFF_REQUIRED',message:'Reviewer/admin required'});
    const note=reviewerNote.trim().slice(0,6000);
    if(status!=='in_review'&&!note)throw new BadRequestException({code:'PRIVACY_REVIEW_RESPONSE_REQUIRED',message:'Final response to the user is required'});
    const r=await this.db.query<any>(`UPDATE privacy_request SET status=$2,reviewer_note=CASE WHEN $3='' THEN reviewer_note ELSE $3 END,reviewed_by=$4,resolved_at=CASE WHEN $2 IN ('completed','rejected') THEN now() ELSE NULL END WHERE id=$1 AND status IN ('open','in_review') RETURNING id,user_id,request_type,status`,[id,status,note,user.id]);
    if(!r.rows[0])throw new NotFoundException({code:'PRIVACY_REQUEST_NOT_FOUND',message:'Privacy request not found or already closed'});
    const event=status==='in_review'?'privacy.review_started':'privacy.resolved';
    await this.db.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,'privacy_request',$4,$5::jsonb)`,[user.id,user.sessionId,event,id,JSON.stringify({status,type:r.rows[0].request_type})]);
    return{ok:true,id,status};
  }

}
