import fs from 'node:fs';
const must=(p,s)=>{const x=fs.readFileSync(p,'utf8');if(!x.includes(s))throw new Error(`Missing ${s} in ${p}`);console.log('PASS',s)};
must('apps/mobile/src/ui/route-preview.tsx','key={`line:${routeKey}`}');
must('apps/api/src/routing/routing.service.ts',"service_usage_counter");
must('apps/api/src/staff/staff-finance.service.ts','Mapbox Directions');
must('apps/mobile/app/staff-finance.tsx','FREE TIER RADAR');
must('apps/mobile/app/staff.tsx','Фінанси & ресурси');
must('infra/postgres/migrations/028_staff_finance_usage.sql','operating_cost_plan');
console.log('PASS finance + resource control center fixture');
