import fs from 'node:fs';
const staff=fs.readFileSync('apps/mobile/app/staff.tsx','utf8');
const screen=fs.readFileSync('apps/mobile/app/professional-review.tsx','utf8');
const service=fs.readFileSync('apps/api/src/staff/staff.service.ts','utf8');
const controller=fs.readFileSync('apps/api/src/staff/staff.controller.ts','utf8');
const carrier=fs.readFileSync('apps/api/src/carrier-mode/carrier-mode.service.ts','utf8');
const checks=[
 ['staff queue entry',/ФОП \/ бізнес/.test(staff)&&/professional-review/.test(staff)],
 ['overview capability + count',/professionalCarriers/.test(service)&&/professional_status='pending'/.test(service)],
 ['review screen',/ПІДТВЕРДИТИ ФОП/.test(screen)&&/ВІДХИЛИТИ ЗАЯВКУ/.test(screen)&&/businessRegistrationRef/.test(screen)],
 ['staff authorization',/PROFESSIONAL_REVIEWER_REQUIRED/.test(controller)&&/ForbiddenException/.test(controller)],
 ['mandatory review note',/min\(3\)/.test(controller)&&/note/.test(controller)],
 ['atomic pending-only decision',/professional_status='pending' RETURNING user_id/.test(carrier)],
 ['verification context',/identityStatus/.test(carrier)&&/licenseStatus/.test(carrier)&&/verifiedVehicleCount/.test(carrier)],
];
let ok=true;for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`);if(!pass)ok=false}if(!ok)process.exit(1);console.log('PASS professional carrier reviewer workflow fixture');
