import { apiFetch, readJsonSafe } from '@/api/client';

export type VerificationSnapshot = {
  identity:{status:string};
  driverLicense:{status:string};
  vehicles:Array<{vehicleId?:string;id?:string;label?:string;status:string}>;
  readiness:{senderReady:boolean;driverReady:boolean};
  capabilities?:{canDrive:boolean};
};

export type CarrierSnapshot = {
  mode:'casual'|'professional';
  professionalStatus:string;
  acceptedCasualPolicyAt?:string|null;
  businessName?:string|null;
};

export type DriverReadiness = {
  verification:VerificationSnapshot;
  carrier:CarrierSnapshot;
  identityReady:boolean;
  licenseReady:boolean;
  vehicleReady:boolean;
  carrierReady:boolean;
  ready:boolean;
  completed:number;
  total:number;
  next:'identity'|'license'|'vehicle'|'carrier'|null;
};

export async function loadDriverReadiness():Promise<DriverReadiness>{
  const [vr,cr]=await Promise.all([apiFetch('/verification/me'),apiFetch('/carrier-mode/me')]);
  const verification=await readJsonSafe<VerificationSnapshot>(vr);
  const carrier=await readJsonSafe<CarrierSnapshot>(cr);
  if(!vr.ok||!verification)throw new Error((verification as any)?.message??'Не вдалося перевірити статус верифікації');
  if(!cr.ok||!carrier)throw new Error((carrier as any)?.message??'Не вдалося перевірити режим перевізника');
  const identityReady=verification.identity?.status==='verified';
  const licenseReady=verification.driverLicense?.status==='verified';
  const vehicleReady=(verification.vehicles??[]).some(v=>v.status==='verified');
  const carrierReady=carrier.mode==='casual'?!!carrier.acceptedCasualPolicyAt:carrier.professionalStatus==='verified';
  const completed=[identityReady,licenseReady,vehicleReady,carrierReady].filter(Boolean).length;
  const next=!identityReady?'identity':!licenseReady?'license':!vehicleReady?'vehicle':!carrierReady?'carrier':null;
  return {verification,carrier,identityReady,licenseReady,vehicleReady,carrierReady,ready:identityReady&&licenseReady&&vehicleReady&&carrierReady,completed,total:4,next};
}

export function carrierLabel(r:DriverReadiness|null){
  if(!r)return 'НЕ НАЛАШТОВАНО';
  if(r.carrier.mode==='professional')return r.carrier.professionalStatus==='verified'?'CARGOGO PRO · VERIFIED':`CARGOGO PRO · ${r.carrier.professionalStatus.toUpperCase()}`;
  return r.carrier.acceptedCasualPolicyAt?'ПОПУТНИК · ПРАВИЛА ПРИЙНЯТО':'ПОПУТНИК · ПОТРІБНА ЗГОДА';
}
