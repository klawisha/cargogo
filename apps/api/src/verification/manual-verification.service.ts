import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import { VerificationStorageService } from './verification-storage.service';

export type VerificationSubject='identity'|'driver_license'|'vehicle';
export type VerificationDocumentKind='identity_front'|'identity_back'|'selfie'|'driver_license_front'|'driver_license_back'|'vehicle_registration_front'|'vehicle_registration_back'|'vehicle_front'|'vehicle_rear'|'vehicle_left'|'vehicle_right'|'insurance';
const allowedMime=new Set(['image/jpeg','image/png','application/pdf']);
const imageOnly=new Set<VerificationDocumentKind>(['selfie','vehicle_front','vehicle_rear','vehicle_left','vehicle_right']);
const required:{[K in VerificationSubject]:(documentKind?:string,insuranceRequired?:boolean)=>VerificationDocumentKind[]}={
  identity:(kind)=>kind==='id_card'?['identity_front','identity_back','selfie']:['identity_front','selfie'],
  driver_license:()=>['driver_license_front','driver_license_back'],
  vehicle:(_,insurance=true)=>insurance?['vehicle_registration_front','vehicle_registration_back','vehicle_front','vehicle_rear','insurance']:['vehicle_registration_front','vehicle_registration_back','vehicle_front','vehicle_rear'],
};

@Injectable()
export class ManualVerificationService{
  constructor(
    @Inject(DatabaseService) private readonly db:DatabaseService,
    @Inject(ConfigService) private readonly config:ConfigService,
    private readonly storage:VerificationStorageService,
  ){}
  private maxBytes(){return this.config.get<number>('VERIFICATION_UPLOAD_MAX_BYTES')??10*1024*1024}
  private uploadTtl(){return this.config.get<number>('VERIFICATION_UPLOAD_URL_TTL_SECONDS')??600}
  private reviewTtl(){return this.config.get<number>('VERIFICATION_REVIEW_URL_TTL_SECONDS')??300}
  private retentionDays(){return this.config.get<number>('VERIFICATION_DOCUMENT_RETENTION_DAYS')??30}


  async uploadDocument(u:RequestUser,input:{subjectType:VerificationSubject;subjectId?:string;documentKind:VerificationDocumentKind},file:{buffer:Buffer;mimetype:string;size:number}){
    if((this.config.get<string>('KYC_MODE')??'mock')!=='manual')throw new ConflictException({code:'MANUAL_VERIFICATION_DISABLED',message:'Manual verification uploads are disabled'});
    const mimeType=(file.mimetype??'').split(';')[0].trim().toLowerCase();
    if(!allowedMime.has(mimeType))throw new BadRequestException({code:'UNSUPPORTED_DOCUMENT_TYPE',message:'Only JPEG, PNG and PDF verification documents are accepted'});
    if(imageOnly.has(input.documentKind)&&mimeType==='application/pdf')throw new BadRequestException({code:'IMAGE_REQUIRED',message:'This verification item must be an image'});
    const size=Number(file.size??file.buffer?.length??0);
    if(!file.buffer||size<1||size!==file.buffer.length||size>this.maxBytes())throw new BadRequestException({code:'DOCUMENT_TOO_LARGE',message:`Verification document must be between 1 and ${this.maxBytes()} bytes`});
    await this.assertSubjectOwnership(u,input.subjectType,input.subjectId);
    this.assertKindMatchesSubject(input.subjectType,input.documentKind);
    const recent=await this.db.query<{count:string}>(`SELECT count(*)::text AS count FROM verification_document WHERE owner_user_id=$1 AND created_at>now()-interval '1 hour'`,[u.id]);
    if(Number(recent.rows[0]?.count??0)>=20)throw new HttpException({code:'VERIFICATION_UPLOAD_RATE_LIMIT',message:'Too many verification uploads. Try again later.'},HttpStatus.TOO_MANY_REQUESTS);
    const detected=this.storage.detectMime(file.buffer);
    if(detected!==mimeType||!allowedMime.has(detected))throw new BadRequestException({code:'DOCUMENT_CONTENT_INVALID',message:'Uploaded file content does not match the declared type'});
    const id=randomUUID();const ext=mimeType==='image/jpeg'?'jpg':mimeType==='image/png'?'png':'pdf';
    const key=`verification/${u.id}/${input.subjectType}/${input.subjectId??'self'}/${id}.${ext}`;
    await this.db.query(`INSERT INTO verification_document(id,owner_user_id,subject_type,subject_id,document_kind,object_key,mime_type,expected_size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,u.id,input.subjectType,input.subjectId??null,input.documentKind,key,mimeType,size]);
    try{
      await this.storage.putObject(key,file.buffer,mimeType);
      const updated=await this.db.query<any>(`UPDATE verification_document SET upload_status='uploaded',validation_status='validated',actual_size_bytes=$2,confirmed_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,[id,size]);
      return this.documentDto(updated.rows[0]);
    }catch(e){
      await this.storage.deleteObject(key).catch(()=>{});
      await this.rejectDocument(id,'Storage upload failed or file validation rejected').catch(()=>{});
      throw e;
    }
  }

  async createUpload(u:RequestUser,input:{subjectType:VerificationSubject;subjectId?:string;documentKind:VerificationDocumentKind;mimeType:string;sizeBytes:number}){
    if(!allowedMime.has(input.mimeType))throw new BadRequestException({code:'UNSUPPORTED_DOCUMENT_TYPE',message:'Only JPEG, PNG and PDF verification documents are accepted'});
    if(imageOnly.has(input.documentKind)&&input.mimeType==='application/pdf')throw new BadRequestException({code:'IMAGE_REQUIRED',message:'This verification item must be an image'});
    if(input.sizeBytes<1||input.sizeBytes>this.maxBytes())throw new BadRequestException({code:'DOCUMENT_TOO_LARGE',message:`Verification document must be <= ${this.maxBytes()} bytes`});
    await this.assertSubjectOwnership(u,input.subjectType,input.subjectId);
    this.assertKindMatchesSubject(input.subjectType,input.documentKind);
    const id=randomUUID();const ext=input.mimeType==='image/jpeg'?'jpg':input.mimeType==='image/png'?'png':'pdf';
    const key=`verification/${u.id}/${input.subjectType}/${input.subjectId??'self'}/${id}.${ext}`;
    await this.db.query(`INSERT INTO verification_document(id,owner_user_id,subject_type,subject_id,document_kind,object_key,mime_type,expected_size_bytes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,u.id,input.subjectType,input.subjectId??null,input.documentKind,key,input.mimeType,input.sizeBytes]);
    const ttl=this.uploadTtl();return {documentId:id,uploadUrl:this.storage.presign('PUT',key,ttl),expiresInSeconds:ttl,requiredHeaders:{'Content-Type':input.mimeType},maxBytes:this.maxBytes()};
  }

  async confirmUpload(u:RequestUser,id:string){
    const r=await this.db.query<any>(`SELECT * FROM verification_document WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL`,[id,u.id]);const d=r.rows[0];
    if(!d)throw new NotFoundException({code:'VERIFICATION_DOCUMENT_NOT_FOUND',message:'Verification document not found'});
    if(d.upload_status==='uploaded'&&d.validation_status==='validated')return this.documentDto(d);
    const inspected=await this.storage.inspectObject(d.object_key);
    if(inspected.size<1||inspected.size>this.maxBytes()||inspected.size>Number(d.expected_size_bytes)+64*1024){
      await this.rejectDocument(d.id,'File size does not match the declared upload');throw new BadRequestException({code:'DOCUMENT_SIZE_MISMATCH',message:'Uploaded document size is invalid'});
    }
    if(inspected.detected!==d.mime_type||!allowedMime.has(inspected.detected)){
      await this.rejectDocument(d.id,'Magic-byte MIME validation failed');throw new BadRequestException({code:'DOCUMENT_CONTENT_INVALID',message:'Uploaded file content does not match the declared type'});
    }
    const updated=await this.db.query<any>(`UPDATE verification_document SET upload_status='uploaded',validation_status='validated',actual_size_bytes=$2,confirmed_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,[id,inspected.size]);
    return this.documentDto(updated.rows[0]);
  }

  async listMine(u:RequestUser){const r=await this.db.query<any>(`SELECT id,subject_type,subject_id,document_kind,mime_type,actual_size_bytes,upload_status,validation_status,rejection_reason,confirmed_at,created_at FROM verification_document WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,[u.id]);return r.rows.map((x:any)=>this.documentDto(x))}

  async removeMine(u:RequestUser,id:string){
    const r=await this.db.query<any>(`SELECT * FROM verification_document WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL FOR UPDATE`,[id,u.id]);const d=r.rows[0];if(!d)throw new NotFoundException({code:'VERIFICATION_DOCUMENT_NOT_FOUND',message:'Verification document not found'});
    const active=await this.db.query(`SELECT 1 FROM verification_review_case WHERE owner_user_id=$1 AND subject_type=$2 AND subject_id IS NOT DISTINCT FROM $3 AND status IN ('queued','in_review') LIMIT 1`,[u.id,d.subject_type,d.subject_id]);
    if(active.rowCount)throw new ConflictException({code:'DOCUMENT_LOCKED_FOR_REVIEW',message:'Documents cannot be removed while verification is under review'});
    await this.storage.deleteObject(d.object_key).catch(()=>{});await this.db.query(`UPDATE verification_document SET upload_status='deleted',deleted_at=now(),updated_at=now() WHERE id=$1`,[id]);return{ok:true};
  }

  async assertRequiredDocuments(client:PoolClient,u:RequestUser,subject:VerificationSubject,subjectId:string|null,options:{documentKind?:string;insuranceRequired?:boolean}={}){
    if((this.config.get<string>('KYC_MODE')??'mock')!=='manual')return;
    const kinds=required[subject](options.documentKind,options.insuranceRequired);
    const r=await client.query<{document_kind:string}>(`SELECT DISTINCT document_kind FROM verification_document WHERE owner_user_id=$1 AND subject_type=$2 AND subject_id IS NOT DISTINCT FROM $3 AND upload_status='uploaded' AND validation_status='validated' AND deleted_at IS NULL`,[u.id,subject,subjectId]);
    const have=new Set(r.rows.map(x=>x.document_kind));const missing=kinds.filter(k=>!have.has(k));if(missing.length)throw new ConflictException({code:'VERIFICATION_DOCUMENTS_REQUIRED',message:'Upload all required verification documents before submitting',missing});
  }

  async queueReview(client:PoolClient,u:RequestUser,subject:VerificationSubject,subjectId:string|null){
    if((this.config.get<string>('KYC_MODE')??'mock')!=='manual')return null;
    const r=await client.query<any>(`INSERT INTO verification_review_case(owner_user_id,subject_type,subject_id,status,submitted_at,updated_at)
      VALUES($1,$2,$3,'queued',now(),now()) ON CONFLICT DO NOTHING RETURNING id`,[u.id,subject,subjectId]);
    if(r.rows[0])return r.rows[0].id;
    const existing=await client.query<any>(`SELECT id FROM verification_review_case WHERE owner_user_id=$1 AND subject_type=$2 AND subject_id IS NOT DISTINCT FROM $3 AND status IN ('queued','in_review') LIMIT 1`,[u.id,subject,subjectId]);return existing.rows[0]?.id??null;
  }

  async queue(u:RequestUser,limit=50){this.assertReviewer(u);const r=await this.db.query<any>(`SELECT c.id,c.subject_type,c.subject_id,c.status,c.priority,c.submitted_at,c.review_started_at,c.assigned_to,u.display_name,u.email,u.phone_e164 FROM verification_review_case c JOIN app_user u ON u.id=c.owner_user_id WHERE c.status IN ('queued','in_review') ORDER BY c.priority ASC,c.submitted_at ASC LIMIT $1`,[Math.min(Math.max(limit,1),100)]);return r.rows.map((x:any)=>({id:x.id,subjectType:x.subject_type,subjectId:x.subject_id,status:x.status,priority:x.priority,submittedAt:x.submitted_at,reviewStartedAt:x.review_started_at,assignedTo:x.assigned_to,user:{displayName:x.display_name,email:x.email,phone:x.phone_e164}}))}

  async claim(u:RequestUser,caseId:string){this.assertReviewer(u);return this.db.transaction(async c=>{const r=await c.query<any>(`SELECT * FROM verification_review_case WHERE id=$1 FOR UPDATE`,[caseId]);const x=r.rows[0];if(!x)throw new NotFoundException({code:'REVIEW_CASE_NOT_FOUND',message:'Review case not found'});if(x.status==='resolved')throw new ConflictException({code:'REVIEW_ALREADY_RESOLVED',message:'Review case is already resolved'});if(x.assigned_to&&x.assigned_to!==u.id)throw new ConflictException({code:'REVIEW_ALREADY_CLAIMED',message:'Review case is already assigned'});await c.query(`UPDATE verification_review_case SET status='in_review',assigned_to=$2,review_started_at=COALESCE(review_started_at,now()),updated_at=now() WHERE id=$1`,[caseId,u.id]);return{ok:true,caseId}})}

  async reviewDetail(u:RequestUser,caseId:string){this.assertReviewer(u);const r=await this.db.query<any>(`SELECT c.*,a.display_name,a.email,a.phone_e164 FROM verification_review_case c JOIN app_user a ON a.id=c.owner_user_id WHERE c.id=$1`,[caseId]);const x=r.rows[0];if(!x)throw new NotFoundException({code:'REVIEW_CASE_NOT_FOUND',message:'Review case not found'});const docs=await this.db.query<any>(`SELECT id,document_kind,mime_type,actual_size_bytes,confirmed_at,validation_status FROM verification_document WHERE owner_user_id=$1 AND subject_type=$2 AND subject_id IS NOT DISTINCT FROM $3 AND upload_status='uploaded' AND deleted_at IS NULL ORDER BY created_at`,[x.owner_user_id,x.subject_type,x.subject_id]);return{id:x.id,subjectType:x.subject_type,subjectId:x.subject_id,status:x.status,decision:x.decision,decisionReason:x.decision_reason,submittedAt:x.submitted_at,assignedTo:x.assigned_to,user:{displayName:x.display_name,email:x.email,phone:x.phone_e164},documents:docs.rows.map((d:any)=>this.documentDto(d))}}

  async documentAccess(u:RequestUser,caseId:string,documentId:string,purpose:string){this.assertReviewer(u);const r=await this.db.query<any>(`SELECT d.object_key FROM verification_document d JOIN verification_review_case c ON c.owner_user_id=d.owner_user_id AND c.subject_type=d.subject_type AND c.subject_id IS NOT DISTINCT FROM d.subject_id WHERE c.id=$1 AND d.id=$2 AND d.upload_status='uploaded' AND d.validation_status='validated' AND d.deleted_at IS NULL`,[caseId,documentId]);const d=r.rows[0];if(!d)throw new NotFoundException({code:'VERIFICATION_DOCUMENT_NOT_FOUND',message:'Document not found for review case'});await this.db.query(`INSERT INTO verification_document_access_log(document_id,actor_user_id,review_case_id,purpose) VALUES($1,$2,$3,$4)`,[documentId,u.id,caseId,purpose]);const ttl=this.reviewTtl();return{url:this.storage.presign('GET',d.object_key,ttl),expiresInSeconds:ttl}}

  async decide(u:RequestUser,caseId:string,input:{decision:'verified'|'rejected'|'needs_resubmission';reason:string}){
    this.assertReviewer(u);return this.db.transaction(async c=>{const q=await c.query<any>(`SELECT * FROM verification_review_case WHERE id=$1 FOR UPDATE`,[caseId]);const x=q.rows[0];if(!x)throw new NotFoundException({code:'REVIEW_CASE_NOT_FOUND',message:'Review case not found'});if(x.status==='resolved')throw new ConflictException({code:'REVIEW_ALREADY_RESOLVED',message:'Review case is already resolved'});if(x.assigned_to&&x.assigned_to!==u.id&&u.staffRole!=='admin')throw new ForbiddenException({code:'REVIEW_ASSIGNED_TO_OTHER',message:'Review case is assigned to another reviewer'});
      const status=input.decision;const reason=input.reason.trim();
      if(x.subject_type==='identity'){
        await c.query(`UPDATE identity_verification_profile SET status=$2,reviewed_at=now(),verified_at=CASE WHEN $2='verified' THEN now() ELSE NULL END,rejection_reason=CASE WHEN $2='verified' THEN NULL ELSE $3 END,updated_at=now() WHERE user_id=$1`,[x.owner_user_id,status,reason]);
        await c.query(`UPDATE app_user SET verification_status=CASE WHEN $2='verified' THEN 'verified' WHEN $2='rejected' THEN 'rejected' ELSE 'pending' END,updated_at=now() WHERE id=$1`,[x.owner_user_id,status]);
      }else if(x.subject_type==='driver_license'){
        await c.query(`UPDATE driver_license_verification SET status=$2,reviewed_at=now(),verified_at=CASE WHEN $2='verified' THEN now() ELSE NULL END,rejection_reason=CASE WHEN $2='verified' THEN NULL ELSE $3 END,updated_at=now() WHERE user_id=$1`,[x.owner_user_id,status,reason]);
      }else{
        await c.query(`UPDATE vehicle_verification SET status=$2,reviewed_at=now(),verified_at=CASE WHEN $2='verified' THEN now() ELSE NULL END,rejection_reason=CASE WHEN $2='verified' THEN NULL ELSE $3 END,registration_document_status=CASE WHEN $2='verified' THEN 'verified' WHEN $2='rejected' THEN 'rejected' ELSE registration_document_status END,insurance_status=CASE WHEN $2='verified' AND insurance_status<>'not_required' THEN 'verified' WHEN $2='rejected' AND insurance_status<>'not_required' THEN 'rejected' ELSE insurance_status END,updated_at=now() WHERE vehicle_id=$1`,[x.subject_id,status,reason]);
        await c.query(`UPDATE vehicle SET verification_status=CASE WHEN $2='verified' THEN 'verified' WHEN $2='rejected' THEN 'rejected' ELSE 'pending' END,updated_at=now() WHERE id=$1`,[x.subject_id,status]);
      }
      await c.query(`UPDATE verification_review_case SET status='resolved',assigned_to=COALESCE(assigned_to,$2),decision=$3,decision_reason=$4,resolved_at=now(),updated_at=now() WHERE id=$1`,[caseId,u.id,status,reason]);
      await c.query(`UPDATE verification_document SET retention_until=now()+($4::text||' days')::interval,updated_at=now() WHERE owner_user_id=$1 AND subject_type=$2 AND subject_id IS NOT DISTINCT FROM $3 AND deleted_at IS NULL`,[x.owner_user_id,x.subject_type,x.subject_id,this.retentionDays()]);
      await c.query(`INSERT INTO verification_event(user_id,actor_user_id,subject_type,subject_id,event_type,from_status,to_status,provider,metadata) VALUES($1,$2,$3,$4,'manual_review_decision','under_review',$5,'manual',$6::jsonb)`,[x.owner_user_id,u.id,x.subject_type,x.subject_id,status,JSON.stringify({reviewCaseId:caseId,reason})]);
      return{ok:true,caseId,decision:status};
    })
  }

  async purgeExpired(u:RequestUser){this.assertReviewer(u);const r=await this.db.query<any>(`SELECT id,object_key FROM verification_document WHERE retention_until<=now() AND deleted_at IS NULL LIMIT 100`);let deleted=0;for(const d of r.rows){try{await this.storage.deleteObject(d.object_key);await this.db.query(`UPDATE verification_document SET upload_status='deleted',deleted_at=now(),updated_at=now() WHERE id=$1`,[d.id]);deleted++}catch{}}return{ok:true,deleted}}

  private assertReviewer(u:RequestUser){if(u.staffRole!=='reviewer'&&u.staffRole!=='verification_reviewer'&&u.staffRole!=='admin')throw new ForbiddenException({code:'VERIFICATION_REVIEWER_REQUIRED',message:'Verification reviewer role required'})}
  private assertKindMatchesSubject(subject:VerificationSubject,kind:VerificationDocumentKind){if(subject==='identity'&&!['identity_front','identity_back','selfie'].includes(kind))throw new BadRequestException({code:'DOCUMENT_KIND_MISMATCH',message:'Document kind does not match identity verification'});if(subject==='driver_license'&&!kind.startsWith('driver_license_'))throw new BadRequestException({code:'DOCUMENT_KIND_MISMATCH',message:'Document kind does not match driver license verification'});if(subject==='vehicle'&&!['vehicle_registration_front','vehicle_registration_back','vehicle_front','vehicle_rear','vehicle_left','vehicle_right','insurance'].includes(kind))throw new BadRequestException({code:'DOCUMENT_KIND_MISMATCH',message:'Document kind does not match vehicle verification'})}
  private async assertSubjectOwnership(u:RequestUser,subject:VerificationSubject,subjectId?:string){if(subject==='vehicle'){if(!subjectId)throw new BadRequestException({code:'SUBJECT_ID_REQUIRED',message:'Vehicle id is required'});const r=await this.db.query(`SELECT 1 FROM vehicle WHERE id=$1 AND owner_id=$2 AND status='active'`,[subjectId,u.id]);if(!r.rowCount)throw new NotFoundException({code:'VEHICLE_NOT_FOUND',message:'Vehicle not found'})}else if(subjectId)throw new BadRequestException({code:'SUBJECT_ID_NOT_ALLOWED',message:'subjectId is only used for vehicle verification'})}
  private async rejectDocument(id:string,reason:string){await this.db.query(`UPDATE verification_document SET upload_status='rejected',validation_status='rejected',rejection_reason=$2,updated_at=now() WHERE id=$1`,[id,reason])}
  private documentDto(d:any){return{id:d.id,subjectType:d.subject_type,subjectId:d.subject_id??null,documentKind:d.document_kind,mimeType:d.mime_type,sizeBytes:d.actual_size_bytes===null||d.actual_size_bytes===undefined?null:Number(d.actual_size_bytes),uploadStatus:d.upload_status,validationStatus:d.validation_status,rejectionReason:d.rejection_reason??null,confirmedAt:d.confirmed_at??null,createdAt:d.created_at??null}}
}
