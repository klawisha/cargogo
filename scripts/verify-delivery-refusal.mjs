import fs from 'node:fs';
const req=(p,s)=>{const t=fs.readFileSync(p,'utf8');for(const x of s){if(!t.includes(x)){console.error('FAIL',p,'missing',x);process.exit(1)}}};
req('infra/postgres/migrations/019_delivery_confirmation_evidence.sql',['deal_delivery_confirmation_problem','accuracy_meters','delivery_confirmation_refused']);
req('apps/api/src/deals/deal.service.ts',['reportDeliveryProblem','delivery.confirmation_problem','canReportDeliveryProblem','location_status']);
req('apps/api/src/deals/deal.controller.ts',["delivery/report-problem",'deliveryProblemSchema']);
req('apps/mobile/app/deal/[id].tsx',['expo-location','getEvidenceLocation','ОТРИМУВАЧ НЕ ПІДТВЕРДЖУЄ ДОСТАВКУ','GPS ±']);
req('apps/mobile/src/api/client.ts',['locationStatus','accuracyMeters','clientCapturedAt']);
console.log('PASS delivery refusal + location evidence fixture');
