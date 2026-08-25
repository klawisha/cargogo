import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import type { SubmitDriverLicenseInput, SubmitIdentityInput, SubmitVehicleVerificationInput } from './verification.schemas';
import { ManualVerificationService } from './manual-verification.service';

type DetailedStatus='not_started'|'draft'|'submitted'|'under_review'|'verified'|'rejected'|'needs_resubmission'|'expired'|'suspended';
const finalBlocked = new Set<DetailedStatus>(['suspended']);

@Injectable()
export class VerificationService {
  constructor(@Inject(DatabaseService) private readonly db:DatabaseService,@Inject(ConfigService) private readonly config:ConfigService,private readonly manual:ManualVerificationService){}

  private mode(){return this.config.get<string>('KYC_MODE')??'disabled'}
  private enforcement(){return this.config.get<string>('VERIFICATION_ENFORCEMENT')==='on'}
  private provider(){return this.mode()==='mock'?'mock':this.mode()==='manual'?'manual':'none'}
  private submittedStatus():DetailedStatus{return this.mode()==='manual'?'under_review':'submitted'}

  async mine(u:RequestUser){
    const [identity,license,vehicles]=await Promise.all([
      this.db.query<any>('SELECT * FROM identity_verification_profile WHERE user_id=$1',[u.id]),
      this.db.query<any>('SELECT * FROM driver_license_verification WHERE user_id=$1',[u.id]),
      this.db.query<any>(`SELECT v.id,v.label,v.body_type,v.verification_status AS legacy_status,vv.*
        FROM vehicle v LEFT JOIN vehicle_verification vv ON vv.vehicle_id=v.id
        WHERE v.owner_id=$1 AND v.status='active' ORDER BY v.created_at DESC`,[u.id]),
    ]);
    const identityDto=this.identityDto(identity.rows[0]);
    const licenseDto=this.licenseDto(license.rows[0]);
    const vehicleDtos=vehicles.rows.map((r:any)=>this.vehicleDto(r));
    return {
      accountStatus:u.verificationStatus,
      mode:this.mode(),
      enforcement:this.enforcement(),
      providerConfigured:this.mode()!=='disabled',
      identity:identityDto,
      driverLicense:licenseDto,
      vehicles:vehicleDtos,
      readiness:{
        senderReady:identityDto.status==='verified',
        driverReady:identityDto.status==='verified'&&licenseDto.status==='verified'&&vehicleDtos.some((v:any)=>v.status==='verified'),
      },
      capabilities:{
        canPublishCargo:!this.enforcement()||identityDto.status==='verified',
        canDrive:!this.enforcement()||(identityDto.status==='verified'&&licenseDto.status==='verified'&&vehicleDtos.some((v:any)=>v.status==='verified')),
      },
    };
  }

  async submitIdentity(u:RequestUser,input:SubmitIdentityInput){
    this.assertEnabled();
    return this.db.transaction(async c=>{
      const current=await c.query<any>('SELECT * FROM identity_verification_profile WHERE user_id=$1 FOR UPDATE',[u.id]);
      await this.manual.assertRequiredDocuments(c,u,'identity',null,{documentKind:input.documentKind});
      if(current.rows[0]?.status==='verified')throw new ConflictException({code:'IDENTITY_ALREADY_VERIFIED',message:'Identity is already verified'});
      if(current.rows[0]&&finalBlocked.has(current.rows[0].status))throw new ConflictException({code:'IDENTITY_SUSPENDED',message:'Identity verification is suspended'});
      const status=this.submittedStatus();
      const r=await c.query<any>(`INSERT INTO identity_verification_profile(user_id,status,document_kind,document_country,document_last4,provider,submitted_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,now(),now())
        ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,document_kind=EXCLUDED.document_kind,document_country=EXCLUDED.document_country,
          document_last4=EXCLUDED.document_last4,provider=EXCLUDED.provider,provider_reference=NULL,rejection_code=NULL,rejection_reason=NULL,
          submitted_at=now(),reviewed_at=NULL,verified_at=NULL,expires_at=NULL,updated_at=now()
        RETURNING *`,[u.id,status,input.documentKind,input.documentCountry,input.documentLast4,this.provider()]);
      await c.query("UPDATE app_user SET verification_status='pending',updated_at=now() WHERE id=$1",[u.id]);
      await this.manual.queueReview(c,u,'identity',null);
      await this.event(c,u,'identity',u.id,'submitted',current.rows[0]?.status??'not_started',status,{documentKind:input.documentKind,documentCountry:input.documentCountry});
      return this.identityDto(r.rows[0]);
    });
  }

  async submitDriverLicense(u:RequestUser,input:SubmitDriverLicenseInput){
    this.assertEnabled();
    if(input.expiresAt&&new Date(input.expiresAt).getTime()<=Date.now())throw new ConflictException({code:'LICENSE_EXPIRED',message:'Driver license expiry must be in the future'});
    return this.db.transaction(async c=>{
      const current=await c.query<any>('SELECT * FROM driver_license_verification WHERE user_id=$1 FOR UPDATE',[u.id]);
      await this.manual.assertRequiredDocuments(c,u,'driver_license',null);
      if(current.rows[0]?.status==='verified')throw new ConflictException({code:'LICENSE_ALREADY_VERIFIED',message:'Driver license is already verified'});
      const status=this.submittedStatus();
      const r=await c.query<any>(`INSERT INTO driver_license_verification(user_id,status,country_code,license_last4,categories,provider,submitted_at,expires_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,now(),$7,now())
        ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,country_code=EXCLUDED.country_code,license_last4=EXCLUDED.license_last4,
          categories=EXCLUDED.categories,provider=EXCLUDED.provider,provider_reference=NULL,rejection_code=NULL,rejection_reason=NULL,
          submitted_at=now(),reviewed_at=NULL,verified_at=NULL,expires_at=EXCLUDED.expires_at,updated_at=now()
        RETURNING *`,[u.id,status,input.countryCode,input.licenseLast4,input.categories,this.provider(),input.expiresAt??null]);
      await this.manual.queueReview(c,u,'driver_license',null);
      await this.event(c,u,'driver_license',u.id,'submitted',current.rows[0]?.status??'not_started',status,{countryCode:input.countryCode,categories:input.categories});
      return this.licenseDto(r.rows[0]);
    });
  }

  async submitVehicle(u:RequestUser,vehicleId:string,input:SubmitVehicleVerificationInput){
    this.assertEnabled();
    return this.db.transaction(async c=>{
      const vehicle=await c.query<any>("SELECT id,owner_id,label,body_type,status FROM vehicle WHERE id=$1 FOR UPDATE",[vehicleId]);
      if(!vehicle.rows[0]||vehicle.rows[0].owner_id!==u.id)throw new NotFoundException({code:'VEHICLE_NOT_FOUND',message:'Vehicle not found'});
      if(vehicle.rows[0].status!=='active')throw new ConflictException({code:'VEHICLE_ARCHIVED',message:'Vehicle is archived'});
      const current=await c.query<any>('SELECT * FROM vehicle_verification WHERE vehicle_id=$1 FOR UPDATE',[vehicleId]);
      await this.manual.assertRequiredDocuments(c,u,'vehicle',vehicleId,{insuranceRequired:input.insuranceRequired});
      if(current.rows[0]?.status==='verified')throw new ConflictException({code:'VEHICLE_ALREADY_VERIFIED',message:'Vehicle is already verified'});
      const status=this.submittedStatus();
      const masked=this.maskRegistration(input.registrationNumber);
      const r=await c.query<any>(`INSERT INTO vehicle_verification(vehicle_id,owner_user_id,status,registration_country,registration_number_masked,vin_last6,make,model,year,color,
          registration_document_status,insurance_status,provider,submitted_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'submitted',$11,$12,now(),now())
        ON CONFLICT(vehicle_id) DO UPDATE SET status=EXCLUDED.status,registration_country=EXCLUDED.registration_country,registration_number_masked=EXCLUDED.registration_number_masked,
          vin_last6=EXCLUDED.vin_last6,make=EXCLUDED.make,model=EXCLUDED.model,year=EXCLUDED.year,color=EXCLUDED.color,
          registration_document_status='submitted',insurance_status=EXCLUDED.insurance_status,provider=EXCLUDED.provider,provider_reference=NULL,
          rejection_code=NULL,rejection_reason=NULL,submitted_at=now(),reviewed_at=NULL,verified_at=NULL,expires_at=NULL,updated_at=now()
        RETURNING *`,[vehicleId,u.id,status,input.registrationCountry,masked,input.vinLast6,input.make,input.model,input.year,input.color??null,input.insuranceRequired?'submitted':'not_required',this.provider()]);
      await c.query("UPDATE vehicle SET verification_status='pending',updated_at=now() WHERE id=$1",[vehicleId]);
      await this.manual.queueReview(c,u,'vehicle',vehicleId);
      await this.event(c,u,'vehicle',vehicleId,'submitted',current.rows[0]?.status??'not_started',status,{registrationCountry:input.registrationCountry,make:input.make,model:input.model,year:input.year});
      return this.vehicleDto({...vehicle.rows[0],...r.rows[0],legacy_status:'pending'});
    });
  }

  // Compatibility for old alpha clients: starts identity with minimal non-secret metadata.
  async start(u:RequestUser,documentKind:'passport'|'id_card'){
    return this.submitIdentity(u,{documentKind,documentCountry:'UA',documentLast4:'TEST'});
  }

  async devResolve(u:RequestUser,input:{subject:'identity'|'driver_license'|'vehicle';subjectId?:string;status:'verified'|'rejected'|'needs_resubmission'|'expired'|'suspended';reason?:string}){
    if(this.config.get<string>('NODE_ENV')==='production'||this.mode()!=='mock')throw new ForbiddenException({code:'DEV_VERIFICATION_DISABLED',message:'Development verification is disabled'});
    return this.db.transaction(async c=>{
      if(input.subject==='identity')return this.resolveIdentity(c,u,input.status,input.reason);
      if(input.subject==='driver_license')return this.resolveLicense(c,u,input.status,input.reason);
      if(!input.subjectId)throw new ConflictException({code:'SUBJECT_ID_REQUIRED',message:'Vehicle id is required'});
      return this.resolveVehicle(c,u,input.subjectId,input.status,input.reason);
    });
  }

  async assertIdentityVerified(userId:string,client?:PoolClient){
    const sql='SELECT status FROM identity_verification_profile WHERE user_id=$1';
    const params=[userId];
    const r=client
      ? await client.query<{status:string}>(sql,params)
      : await this.db.query<{status:string}>(sql,params);
    if(r.rows[0]?.status!=='verified')throw new ForbiddenException({code:'IDENTITY_VERIFICATION_REQUIRED',message:'Verified identity is required for this action'});
  }

  async assertDriverReady(userId:string,vehicleId:string,client?:PoolClient){
    const sql=`SELECT i.status AS identity_status,l.status AS license_status,vv.status AS vehicle_status
      FROM app_user u LEFT JOIN identity_verification_profile i ON i.user_id=u.id LEFT JOIN driver_license_verification l ON l.user_id=u.id
      LEFT JOIN vehicle_verification vv ON vv.vehicle_id=$2 AND vv.owner_user_id=u.id WHERE u.id=$1`;
    const params=[userId,vehicleId];
    type DriverReadinessRow={identity_status:string|null;license_status:string|null;vehicle_status:string|null};
    const r=client
      ? await client.query<DriverReadinessRow>(sql,params)
      : await this.db.query<DriverReadinessRow>(sql,params);
    const x=r.rows[0];
    if(x?.identity_status!=='verified')throw new ForbiddenException({code:'IDENTITY_VERIFICATION_REQUIRED',message:'Verified identity is required to drive'});
    if(x?.license_status!=='verified')throw new ForbiddenException({code:'DRIVER_LICENSE_VERIFICATION_REQUIRED',message:'Verified driver license is required'});
    if(x?.vehicle_status!=='verified')throw new ForbiddenException({code:'VEHICLE_VERIFICATION_REQUIRED',message:'Verified vehicle is required'});
  }

  private async resolveIdentity(c:PoolClient,u:RequestUser,status:DetailedStatus,reason?:string){
    const current=await c.query<any>('SELECT * FROM identity_verification_profile WHERE user_id=$1 FOR UPDATE',[u.id]);
    if(!current.rows[0])throw new ConflictException({code:'NO_IDENTITY_VERIFICATION',message:'No identity verification submitted'});
    const r=await c.query<any>(`UPDATE identity_verification_profile SET status=$2,rejection_reason=$3,reviewed_at=now(),
      verified_at=CASE WHEN $2='verified' THEN now() ELSE NULL END,updated_at=now() WHERE user_id=$1 RETURNING *`,[u.id,status,status==='verified'?null:(reason??'Development review')]);
    const compat=status==='verified'?'verified':status==='rejected'?'rejected':status==='submitted'||status==='under_review'?'pending':'unverified';
    await c.query('UPDATE app_user SET verification_status=$2,updated_at=now() WHERE id=$1',[u.id,compat]);
    await this.event(c,u,'identity',u.id,'reviewed',current.rows[0].status,status,{reason:reason??null});
    return this.identityDto(r.rows[0]);
  }
  private async resolveLicense(c:PoolClient,u:RequestUser,status:DetailedStatus,reason?:string){
    const current=await c.query<any>('SELECT * FROM driver_license_verification WHERE user_id=$1 FOR UPDATE',[u.id]);
    if(!current.rows[0])throw new ConflictException({code:'NO_LICENSE_VERIFICATION',message:'No driver license verification submitted'});
    const r=await c.query<any>(`UPDATE driver_license_verification SET status=$2,rejection_reason=$3,reviewed_at=now(),verified_at=CASE WHEN $2='verified' THEN now() ELSE NULL END,updated_at=now() WHERE user_id=$1 RETURNING *`,[u.id,status,status==='verified'?null:(reason??'Development review')]);
    await this.event(c,u,'driver_license',u.id,'reviewed',current.rows[0].status,status,{reason:reason??null});
    return this.licenseDto(r.rows[0]);
  }
  private async resolveVehicle(c:PoolClient,u:RequestUser,vehicleId:string,status:DetailedStatus,reason?:string){
    const current=await c.query<any>('SELECT vv.*,v.label,v.body_type FROM vehicle_verification vv JOIN vehicle v ON v.id=vv.vehicle_id WHERE vv.vehicle_id=$1 AND vv.owner_user_id=$2 FOR UPDATE',[vehicleId,u.id]);
    if(!current.rows[0])throw new ConflictException({code:'NO_VEHICLE_VERIFICATION',message:'No vehicle verification submitted'});
    const doc=status==='verified'?'verified':status==='expired'?'expired':status==='rejected'?'rejected':current.rows[0].registration_document_status;
    const insurance=current.rows[0].insurance_status==='not_required'?'not_required':status==='verified'?'verified':status==='expired'?'expired':status==='rejected'?'rejected':current.rows[0].insurance_status;
    const r=await c.query<any>(`UPDATE vehicle_verification SET status=$3,rejection_reason=$4,registration_document_status=$5,insurance_status=$6,reviewed_at=now(),verified_at=CASE WHEN $3='verified' THEN now() ELSE NULL END,updated_at=now() WHERE vehicle_id=$1 AND owner_user_id=$2 RETURNING *`,[vehicleId,u.id,status,status==='verified'?null:(reason??'Development review'),doc,insurance]);
    const compat=status==='verified'?'verified':status==='rejected'?'rejected':status==='submitted'||status==='under_review'?'pending':'unverified';
    await c.query('UPDATE vehicle SET verification_status=$2,updated_at=now() WHERE id=$1',[vehicleId,compat]);
    await this.event(c,u,'vehicle',vehicleId,'reviewed',current.rows[0].status,status,{reason:reason??null});
    return this.vehicleDto({...current.rows[0],...r.rows[0],legacy_status:compat});
  }

  private assertEnabled(){if(this.mode()==='disabled')throw new ConflictException({code:'KYC_NOT_CONFIGURED',message:'Verification is currently disabled'})}
  private maskRegistration(value:string){const s=value.replace(/\s+/g,'').toUpperCase();if(s.length<=4)return '*'.repeat(Math.max(0,s.length-2))+s.slice(-2);return s.slice(0,2)+'*'.repeat(Math.max(2,s.length-4))+s.slice(-2)}
  private async event(c:PoolClient,u:RequestUser,subjectType:'identity'|'driver_license'|'vehicle',subjectId:string,eventType:string,fromStatus:string,toStatus:string,metadata:object){
    await c.query(`INSERT INTO verification_event(user_id,actor_user_id,subject_type,subject_id,event_type,from_status,to_status,provider,metadata)
      VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[u.id,subjectType,subjectId,eventType,fromStatus,toStatus,this.provider(),JSON.stringify(metadata)]);
  }
  private identityDto(r:any){return r?{status:r.status,documentKind:r.document_kind,documentCountry:r.document_country,documentLast4:r.document_last4,provider:r.provider,rejectionReason:r.rejection_reason,submittedAt:r.submitted_at,verifiedAt:r.verified_at,expiresAt:r.expires_at}:{status:'not_started',documentKind:null,documentCountry:null,documentLast4:null,provider:'none',rejectionReason:null,submittedAt:null,verifiedAt:null,expiresAt:null}}
  private licenseDto(r:any){return r?{status:r.status,countryCode:r.country_code,licenseLast4:r.license_last4,categories:r.categories??[],provider:r.provider,rejectionReason:r.rejection_reason,submittedAt:r.submitted_at,verifiedAt:r.verified_at,expiresAt:r.expires_at}:{status:'not_started',countryCode:null,licenseLast4:null,categories:[],provider:'none',rejectionReason:null,submittedAt:null,verifiedAt:null,expiresAt:null}}
  private vehicleDto(r:any){return {vehicleId:r.vehicle_id??r.id,label:r.label,bodyType:r.body_type,status:r.status??'not_started',legacyStatus:r.legacy_status??'unverified',registrationCountry:r.registration_country??null,registrationNumberMasked:r.registration_number_masked??null,vinLast6:r.vin_last6??null,make:r.make??null,model:r.model??null,year:r.year??null,color:r.color??null,registrationDocumentStatus:r.registration_document_status??'not_started',insuranceStatus:r.insurance_status??'not_started',provider:r.provider??'none',rejectionReason:r.rejection_reason??null,submittedAt:r.submitted_at??null,verifiedAt:r.verified_at??null,expiresAt:r.expires_at??null}}
}
