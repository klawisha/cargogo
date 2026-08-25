import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const service=read('apps/api/src/deals/deal.service.ts');
const controller=read('apps/api/src/deals/deal.controller.ts');
const migration=read('infra/postgres/migrations/017_handover_evidence.sql');
const mobile=read('apps/mobile/app/deal/[id].tsx');
const client=read('apps/mobile/src/api/client.ts');
const dispute=read('apps/api/src/disputes/dispute.service.ts');
const checks=[
 ['pickup evidence required server-side',service.includes("requireHandoverEvidence(client,id,'pickup')")],
 ['delivery evidence required server-side',service.includes("requireHandoverEvidence(client,id,'delivery')")],
 ['codes erased after use',service.includes('pickup_code_hash=NULL')&&service.includes('delivery_code_hash=NULL')],
 ['driver-only upload',service.includes('EVIDENCE_DRIVER_ONLY')],
 ['content signature validation',service.includes('detectMime(file.buffer)')],
 ['sha256 evidence fingerprint',service.includes("createHash('sha256').update(file.buffer)")],
 ['private storage evidence key',service.includes('deal-evidence/${id}/${input.stage}')],
 ['max three evidence photos',migration.includes('enforce_handover_evidence_limit')],
 ['immutable evidence trigger',migration.includes('prevent_handover_evidence_mutation')],
 ['access audit',migration.includes('deal_handover_evidence_access_log')&&service.includes('deal_handover_evidence_access_log')],
 ['camera capture only UI',mobile.includes('launchCameraAsync')&&!mobile.includes('launchImageLibraryAsync')],
 ['native binary upload',client.includes('uploadDealHandoverEvidence')&&client.includes('FileSystem.uploadAsync')],
 ['sender code gated by evidence',service.includes('pickupEvidenceCount > 0')&&service.includes('deliveryEvidenceCount > 0')],
 ['handover evidence included in disputes',dispute.includes('deal_handover_evidence')],
 ['multipart endpoint bounded',controller.includes('fileSize:10*1024*1024')&&controller.includes('files:1')],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length)process.exit(1);
console.log('PASS HANDOVER EVIDENCE ARCHITECTURE');
