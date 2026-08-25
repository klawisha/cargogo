import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service'; import type { RequestUser } from '../common/request-user'; import type { CreateCargoInput,UpdateCargoInput } from './cargo.schemas'; import { MatchingService } from '../matching/matching.service'; import { LocationService } from '../locations/location.service'; import { VerificationService } from '../verification/verification.service';
type CargoRow=any;
const selectOwnerCargo=`SELECT c.*,ST_Y(c.pickup_point::geometry) AS pickup_lat,ST_X(c.pickup_point::geometry) AS pickup_lng,ST_Y(c.delivery_point::geometry) AS delivery_lat,ST_X(c.delivery_point::geometry) AS delivery_lng FROM cargo c`;
@Injectable() export class CargoService{
 constructor(@Inject(DatabaseService) private readonly db:DatabaseService,private readonly matching:MatchingService,private readonly locations:LocationService,private readonly verification:VerificationService){}
async create(user: RequestUser, input: CreateCargoInput) {
  this.assertDateOrder(input);
  const pickup = this.locations.resolve(input.pickup);
  const delivery = this.locations.resolve(input.delivery);
  this.assertDifferentPlaces(pickup, delivery);

  return this.db.transaction(async client => {
    const r = await client.query<{ id: string }>(`
      INSERT INTO cargo(
        owner_id,title,description,category,weight_kg,length_cm,width_cm,height_cm,
        reward_minor,declared_value_minor,declared_value_currency,currency,fragile,
        pickup_point,delivery_point,pickup_public_label,delivery_public_label,
        pickup_address_private,delivery_address_private,pickup_country_code,pickup_country_name,
        pickup_city_id,pickup_city_name,pickup_street_private,delivery_country_code,
        delivery_country_name,delivery_city_id,delivery_city_name,delivery_street_private,
        pickup_from,pickup_until,delivery_until,status
      ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        ST_SetSRID(ST_MakePoint($14,$15),4326)::geography,
        ST_SetSRID(ST_MakePoint($16,$17),4326)::geography,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,'draft'
      ) RETURNING id`, [
        user.id,input.title,input.description??null,input.category??null,input.weightKg??null,
        input.lengthCm??null,input.widthCm??null,input.heightCm??null,input.rewardMinor,
        input.declaredValueMinor??null,input.declaredValueMinor==null?null:'UAH',input.currency,input.fragile,
        pickup.lng,pickup.lat,delivery.lng,delivery.lat,pickup.publicLabel,delivery.publicLabel,
        pickup.street,delivery.street,pickup.countryCode,pickup.countryName,pickup.cityId,pickup.cityName,
        pickup.street,delivery.countryCode,delivery.countryName,delivery.cityId,delivery.cityName,delivery.street,
        input.pickupFrom??null,input.pickupUntil??null,input.deliveryUntil??null
      ]);
    await this.audit(client,user,'cargo.created',r.rows[0].id,{status:'draft',declaredValueMinor:input.declaredValueMinor??null});
    return this.getWithClient(client,r.rows[0].id);
  });
}
 async listMine(user:RequestUser){const r=await this.db.query<CargoRow>(`${selectOwnerCargo} WHERE c.owner_id=$1 ORDER BY c.created_at DESC LIMIT 100`,[user.id]);return r.rows.map(this.toOwnerDto);}
 async getMine(user:RequestUser,id:string){const r=await this.db.query<CargoRow>(`${selectOwnerCargo} WHERE c.id=$1`,[id]);if(!r.rows[0])throw new NotFoundException({code:'CARGO_NOT_FOUND',message:'Cargo not found'});if(r.rows[0].owner_id!==user.id)throw new ForbiddenException({code:'CARGO_FORBIDDEN',message:'Not your cargo'});return this.toOwnerDto(r.rows[0]);}
 async update(user:RequestUser,id:string,input:UpdateCargoInput){
  this.assertDateOrder(input);
  return this.db.transaction(async client=>{
    const current=await this.lockOwned(client,id,user.id);
    await this.assertMutable(client,id,current.status);
    const merged=this.merge(current,input);
    const pickup=this.locations.resolve(merged.pickup),delivery=this.locations.resolve(merged.delivery);
    this.assertDifferentPlaces(pickup,delivery);
    await client.query(`UPDATE cargo SET
      title=$2,description=$3,category=$4,weight_kg=$5,length_cm=$6,width_cm=$7,height_cm=$8,
      reward_minor=$9,declared_value_minor=$10,declared_value_currency=$11,currency=$12,fragile=$13,
      pickup_point=ST_SetSRID(ST_MakePoint($14,$15),4326)::geography,
      delivery_point=ST_SetSRID(ST_MakePoint($16,$17),4326)::geography,
      pickup_public_label=$18,delivery_public_label=$19,pickup_address_private=$20,delivery_address_private=$21,
      pickup_country_code=$22,pickup_country_name=$23,pickup_city_id=$24,pickup_city_name=$25,pickup_street_private=$26,
      delivery_country_code=$27,delivery_country_name=$28,delivery_city_id=$29,delivery_city_name=$30,delivery_street_private=$31,
      pickup_from=$32,pickup_until=$33,delivery_until=$34,updated_at=now() WHERE id=$1`,[
      id,merged.title,merged.description??null,merged.category??null,merged.weightKg??null,merged.lengthCm??null,
      merged.widthCm??null,merged.heightCm??null,merged.rewardMinor,merged.declaredValueMinor??null,
      merged.declaredValueMinor==null?null:'UAH',merged.currency,merged.fragile,pickup.lng,pickup.lat,delivery.lng,delivery.lat,
      pickup.publicLabel,delivery.publicLabel,pickup.street,delivery.street,pickup.countryCode,pickup.countryName,pickup.cityId,
      pickup.cityName,pickup.street,delivery.countryCode,delivery.countryName,delivery.cityId,delivery.cityName,delivery.street,
      merged.pickupFrom??null,merged.pickupUntil??null,merged.deliveryUntil??null
    ]);
    if(current.status==='published'){
      await client.query("UPDATE cargo_offer SET status='superseded',updated_at=now() WHERE cargo_id=$1 AND status='pending'",[id]);
      await this.matching.recomputeCargo(client,id);
    }
    await this.audit(client,user,'cargo.updated',id,{status:current.status,offersInvalidated:current.status==='published',declaredValueMinor:merged.declaredValueMinor??null});
    return this.getWithClient(client,id);
  });
}
 async publish(user:RequestUser,id:string){await this.verification.assertIdentityVerified(user.id);return this.db.transaction(async client=>{const c=await this.lockOwned(client,id,user.id);if(c.status!=='draft')throw new ConflictException({code:'INVALID_CARGO_STATE',message:'Only draft cargo can be published'});await client.query("UPDATE cargo SET status='published',updated_at=now() WHERE id=$1",[id]);await this.matching.recomputeCargo(client,id);await this.audit(client,user,'cargo.published',id,{});return this.getWithClient(client,id);});}
 async cancel(user:RequestUser,id:string){return this.db.transaction(async client=>{const c=await this.lockOwned(client,id,user.id);await this.assertMutable(client,id,c.status);await client.query("UPDATE cargo SET status='cancelled',updated_at=now() WHERE id=$1",[id]);await client.query("UPDATE cargo_offer SET status='superseded',updated_at=now() WHERE cargo_id=$1 AND status='pending'",[id]);await this.matching.removeCargo(client,id);await this.audit(client,user,'cargo.cancelled',id,{});return this.getWithClient(client,id);});}
 async remove(user:RequestUser,id:string){return this.db.transaction(async client=>{const c=await this.lockOwned(client,id,user.id);await this.assertMutable(client,id,c.status);await this.matching.removeCargo(client,id);await client.query('DELETE FROM cargo WHERE id=$1',[id]);await this.audit(client,user,'cargo.deleted',id,{});return {ok:true,id};});}
 async discover(user:RequestUser,limit=50){const r=await this.db.query<any>(`SELECT c.id,c.title,c.description,c.category,c.weight_kg,c.length_cm,c.width_cm,c.height_cm,c.reward_minor,c.declared_value_minor,c.declared_value_currency,c.currency,c.fragile,c.pickup_public_label,c.delivery_public_label,c.pickup_country_code,c.pickup_city_name,c.delivery_country_code,c.delivery_city_name,c.pickup_from,c.pickup_until,c.delivery_until,c.photo_count,c.created_at,u.display_name,u.verification_status FROM cargo c JOIN app_user u ON u.id=c.owner_id WHERE c.status='published' AND c.owner_id<>$1 ORDER BY c.created_at DESC LIMIT $2`,[user.id,Math.min(Math.max(limit,1),100)]);return r.rows.map((x:any)=>({id:x.id,title:x.title,description:x.description,category:x.category,weightKg:x.weight_kg===null?null:Number(x.weight_kg),dimensions:{lengthCm:x.length_cm===null?null:Number(x.length_cm),widthCm:x.width_cm===null?null:Number(x.width_cm),heightCm:x.height_cm===null?null:Number(x.height_cm)},rewardMinor:x.reward_minor,declaredValueMinor:x.declared_value_minor==null?null:Number(x.declared_value_minor),declaredValueCurrency:x.declared_value_currency??null,currency:x.currency,fragile:x.fragile,pickupLabel:x.pickup_public_label,deliveryLabel:x.delivery_public_label,pickup:{countryCode:x.pickup_country_code,cityName:x.pickup_city_name},delivery:{countryCode:x.delivery_country_code,cityName:x.delivery_city_name},owner:{displayName:x.display_name,verificationStatus:x.verification_status}}));}
 private async lockOwned(client:PoolClient,id:string,owner:string){const r=await client.query<CargoRow>(`${selectOwnerCargo} WHERE c.id=$1 AND c.owner_id=$2 FOR UPDATE`,[id,owner]);if(!r.rows[0])throw new NotFoundException({code:'CARGO_NOT_FOUND',message:'Cargo not found'});return r.rows[0];}
 private async assertMutable(client:PoolClient,id:string,status:string){if(!['draft','published'].includes(status))throw new ConflictException({code:'CARGO_LOCKED',message:'Cargo can no longer be changed after a deal is accepted'});const d=await client.query("SELECT 1 FROM deal WHERE cargo_id=$1 LIMIT 1",[id]);if(d.rowCount)throw new ConflictException({code:'CARGO_HAS_DEAL',message:'Cargo can no longer be changed after a deal was accepted'});}
 private merge(r:any,i:UpdateCargoInput):CreateCargoInput{return {title:i.title??r.title,description:i.description??r.description??undefined,category:i.category??r.category??undefined,weightKg:i.weightKg??(r.weight_kg===null?undefined:Number(r.weight_kg)),lengthCm:i.lengthCm??(r.length_cm===null?undefined:Number(r.length_cm)),widthCm:i.widthCm??(r.width_cm===null?undefined:Number(r.width_cm)),heightCm:i.heightCm??(r.height_cm===null?undefined:Number(r.height_cm)),rewardMinor:i.rewardMinor??r.reward_minor,declaredValueMinor:Object.prototype.hasOwnProperty.call(i,'declaredValueMinor')?(i.declaredValueMinor??undefined):(r.declared_value_minor===null?undefined:Number(r.declared_value_minor)),currency:i.currency??'UAH',fragile:i.fragile??r.fragile,pickup:i.pickup??{countryCode:r.pickup_country_code,cityId:r.pickup_city_id,street:r.pickup_street_private??''},delivery:i.delivery??{countryCode:r.delivery_country_code,cityId:r.delivery_city_id,street:r.delivery_street_private??''},pickupFrom:i.pickupFrom??r.pickup_from??undefined,pickupUntil:i.pickupUntil??r.pickup_until??undefined,deliveryUntil:i.deliveryUntil??r.delivery_until??undefined};}
 private assertDifferentPlaces(a:any,b:any){if(a.countryCode===b.countryCode&&a.cityId===b.cityId)throw new BadRequestException({code:'SAME_CITY',message:'Pickup and delivery city must be different'});}
 private assertDateOrder(i:Partial<CreateCargoInput>){if(i.pickupFrom&&i.pickupUntil&&new Date(i.pickupUntil)<new Date(i.pickupFrom))throw new BadRequestException({code:'INVALID_DATE_RANGE',message:'pickupUntil must be after pickupFrom'});if(i.pickupUntil&&i.deliveryUntil&&new Date(i.deliveryUntil)<new Date(i.pickupUntil))throw new BadRequestException({code:'INVALID_DATE_RANGE',message:'deliveryUntil must be after pickupUntil'});}
 private async getWithClient(client:PoolClient,id:string){const r=await client.query<CargoRow>(`${selectOwnerCargo} WHERE c.id=$1`,[id]);return this.toOwnerDto(r.rows[0]);}
 private async audit(client:PoolClient,user:RequestUser,eventType:string,id:string,metadata:object){await client.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,'cargo',$4,$5::jsonb)`,[user.id,user.sessionId,eventType,id,JSON.stringify(metadata)]);}
 private toOwnerDto=(r:any)=>({id:r.id,title:r.title,description:r.description,category:r.category,weightKg:r.weight_kg===null?null:Number(r.weight_kg),dimensions:{lengthCm:r.length_cm===null?null:Number(r.length_cm),widthCm:r.width_cm===null?null:Number(r.width_cm),heightCm:r.height_cm===null?null:Number(r.height_cm)},rewardMinor:r.reward_minor,declaredValueMinor:r.declared_value_minor==null?null:Number(r.declared_value_minor),declaredValueCurrency:r.declared_value_currency??null,currency:r.currency,fragile:r.fragile,status:r.status,pickup:{countryCode:r.pickup_country_code,countryName:r.pickup_country_name,cityId:r.pickup_city_id,cityName:r.pickup_city_name,street:r.pickup_street_private,publicLabel:r.pickup_public_label},delivery:{countryCode:r.delivery_country_code,countryName:r.delivery_country_name,cityId:r.delivery_city_id,cityName:r.delivery_city_name,street:r.delivery_street_private,publicLabel:r.delivery_public_label},pickupFrom:r.pickup_from,pickupUntil:r.pickup_until,deliveryUntil:r.delivery_until,photoCount:r.photo_count,createdAt:r.created_at,updatedAt:r.updated_at});
}
