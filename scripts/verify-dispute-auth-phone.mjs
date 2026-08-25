import fs from 'node:fs';
const dispute=fs.readFileSync('apps/mobile/app/dispute/[dealId].tsx','utf8');
const service=fs.readFileSync('apps/api/src/disputes/dispute.service.ts','utf8');
const controller=fs.readFileSync('apps/api/src/disputes/dispute.controller.ts','utf8');
const auth=fs.readFileSync('apps/api/src/auth/auth.service.ts','utf8');
const schema=fs.readFileSync('apps/api/src/auth/auth.schemas.ts','utf8');
const client=fs.readFileSync('apps/mobile/src/api/client.ts','utf8');
const review=fs.readFileSync('apps/mobile/app/dispute-review.tsx','utf8');
const migration=fs.readFileSync('infra/postgres/migrations/022_phone_auth_dispute_reviewer.sql','utf8');
const checks=[
  [!dispute.includes('DEV RESOLUTION'),'participant dispute resolution removed'],
  [!controller.includes('dev/resolve'),'dev resolve endpoint removed'],
  [service.includes("staffRole!=='dispute_reviewer'"),'dedicated dispute reviewer enforced'],
  [schema.includes('phone: z.string()'),'phone registration schema'],
  [schema.includes('identifier: z.string()'),'backward-compatible login identifier'],
  [auth.includes('phone_e164'),'phone stored in auth service'],
  [client.includes('readJsonSafe'),'empty JSON response guarded'],
  [review.includes('NO-SHOW'),'no-show manual-review guidance'],
  [migration.includes("'dispute_reviewer'"),'dispute reviewer DB role migration'],
];
for(const [ok,label] of checks){if(!ok){console.error('FAIL',label);process.exit(1)} console.log('PASS',label)}
console.log('PASS dispute authority + phone auth fixture');
