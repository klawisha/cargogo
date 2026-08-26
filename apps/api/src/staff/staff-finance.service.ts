import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

const money=(v:unknown)=>Number(v??0);
@Injectable()
export class StaffFinanceService{
 constructor(private readonly db:DatabaseService){}
 private assert(user:RequestUser){if(!['reviewer','admin'].includes(user.staffRole??''))throw new ForbiddenException({code:'FINANCE_STAFF_REQUIRED',message:'Finance overview is available only to reviewer/admin'});}
 async dashboard(user:RequestUser){this.assert(user);
   const [month,lifetime,statuses,usage,costs,storage,routingObserved]=await Promise.all([
    this.summary(`date_trunc('month',now())`),this.summary(`'1970-01-01'::timestamptz`),
    this.db.query<any>(`SELECT status,count(*)::int count,coalesce(sum(agreed_amount_minor),0)::bigint amount FROM deal GROUP BY status ORDER BY count(*) DESC`),
    this.db.query<any>(`SELECT service_key AS "serviceKey",metric_key AS "metricKey",usage_value::bigint AS "usageValue",period_start AS "periodStart" FROM service_usage_counter WHERE period_start=date_trunc('month',now())::date ORDER BY service_key,metric_key`),
    this.db.query<any>(`SELECT key,label,category,amount_minor AS "amountMinor",currency,cadence,status,note,source_url AS "sourceUrl" FROM operating_cost_plan WHERE status<>'disabled' ORDER BY category,label`),
    this.storageStats(),
    this.db.query<any>(`SELECT count(*)::int routed FROM trip WHERE route_source='mapbox-directions-v5' AND coalesce(updated_at,created_at)>=date_trunc('month',now())`)
   ]);
   const recordedMapboxReq=this.metric(usage.rows,'mapbox_directions','requests');
   const observedRouted=Math.max(0,Number(routingObserved.rows[0]?.routed??0));
   // A stored Mapbox-routed trip proves at least one Directions request happened, even if the
   // usage table was introduced after that request. Never let the dashboard under-report below
   // the number of current-month routed trip records; exact counting continues in RoutingService.
   const mapboxReq=Math.max(recordedMapboxReq,observedRouted);
   const mapboxErr=this.metric(usage.rows,'mapbox_directions','errors');
   const usageCards=[
    {key:'mapbox_directions',label:'Mapbox Directions',used:mapboxReq,limit:100000,unit:'requests',freeTier:true,status:mapboxReq>=90000?'critical':mapboxReq>=70000?'warning':'ok',detail:`${mapboxErr} errors this month · ${observedRouted} successful routed trip records observed`},
    {key:'cloudflare_r2_storage',label:'Object storage',used:storage.bytes,limit:10*1024*1024*1024,unit:'bytes',freeTier:true,status:storage.bytes>=9*1024**3?'critical':storage.bytes>=7*1024**3?'warning':'ok',detail:`${storage.objects} tracked objects · R2 free tier reference 10 GB-month`},
    {key:'r2_class_a',label:'R2 Class A operations',used:storage.writeEstimate,limit:1_000_000,unit:'operations',freeTier:true,status:'ok',detail:'Estimate from stored/upload records; provider console remains source of truth'},
    {key:'r2_class_b',label:'R2 Class B operations',used:storage.readEstimate,limit:10_000_000,unit:'operations',freeTier:true,status:'ok',detail:'Estimate from evidence access logs; provider console remains source of truth'},
    {key:'google_maps_android',label:'Google Maps Android',used:null,limit:null,unit:'SDK',freeTier:true,status:'info',detail:'No reliable app-side billing counter; monitor Google Cloud billing/quotas'},
    {key:'sms_otp',label:'SMS OTP',used:0,limit:null,unit:'SMS',freeTier:false,status:'planned',detail:'Provider not selected yet'}
   ];
   return {generatedAt:new Date().toISOString(),month,lifetime,statuses:statuses.rows.map((x:any)=>({status:x.status,count:Number(x.count),amountMinor:money(x.amount)})),usage:usageCards,costs:costs.rows.map((x:any)=>({...x,amountMinor:money(x.amountMinor)})),storage};
 }
 private metric(rows:any[],service:string,metric:string){return Number(rows.find(x=>x.serviceKey===service&&x.metricKey===metric)?.usageValue??0)}
 private async summary(startSql:string){const r=await this.db.query<any>(`SELECT count(*)::int deals, count(*) FILTER(WHERE status='completed')::int completed, count(*) FILTER(WHERE status NOT IN('completed','cancelled','refunded'))::int active, coalesce(sum(agreed_amount_minor) FILTER(WHERE status NOT IN('cancelled')),0)::bigint gmv, coalesce(sum(platform_fee_minor) FILTER(WHERE payment_status IN('captured','released')),0)::bigint platform_fees, coalesce(sum(carrier_amount_minor) FILTER(WHERE payment_status IN('captured','released')),0)::bigint carrier_payable, coalesce(sum(coalesce(actual_acquiring_fee_minor,estimated_acquiring_fee_minor)) FILTER(WHERE payment_status IN('captured','released')),0)::bigint acquiring_cost, coalesce(sum(coalesce(actual_payout_fee_minor,estimated_payout_fee_minor)) FILTER(WHERE payment_status IN('captured','released')),0)::bigint payout_cost, coalesce(sum(coalesce(platform_net_revenue_minor,platform_fee_minor-coalesce(actual_acquiring_fee_minor,estimated_acquiring_fee_minor)-coalesce(actual_payout_fee_minor,estimated_payout_fee_minor))) FILTER(WHERE payment_status IN('captured','released')),0)::bigint net_revenue, count(*) FILTER(WHERE status='disputed')::int disputed, count(*) FILTER(WHERE status='refunded')::int refunded FROM deal WHERE created_at >= ${startSql}`);const x=r.rows[0]??{};return {deals:Number(x.deals??0),completed:Number(x.completed??0),active:Number(x.active??0),gmvMinor:money(x.gmv),platformFeesMinor:money(x.platform_fees),carrierPayableMinor:money(x.carrier_payable),acquiringCostMinor:money(x.acquiring_cost),payoutCostMinor:money(x.payout_cost),netRevenueMinor:money(x.net_revenue),disputed:Number(x.disputed??0),refunded:Number(x.refunded??0)};}
 private async storageStats(){const r=await this.db.query<any>(`SELECT (coalesce((SELECT sum(expected_size_bytes) FROM verification_document WHERE deleted_at IS NULL AND upload_status='uploaded'),0)+coalesce((SELECT sum(size_bytes) FROM deal_handover_evidence),0))::bigint bytes,(coalesce((SELECT count(*) FROM verification_document WHERE deleted_at IS NULL AND upload_status='uploaded'),0)+coalesce((SELECT count(*) FROM deal_handover_evidence),0)+coalesce((SELECT count(*) FROM dispute_evidence WHERE kind='photo'),0))::bigint objects,(coalesce((SELECT count(*) FROM verification_document_access_log),0)+coalesce((SELECT count(*) FROM deal_handover_evidence_access_log),0)+coalesce((SELECT count(*) FROM dispute_evidence_access_log),0))::bigint reads`);const x=r.rows[0]??{};const objects=Number(x.objects??0);return {bytes:Number(x.bytes??0),objects,writeEstimate:objects,readEstimate:Number(x.reads??0)};}
}
