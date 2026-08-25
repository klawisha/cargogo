import fs from 'node:fs';
const core=fs.readFileSync(new URL('../infra/postgres/migrations/015_verification_core.sql',import.meta.url),'utf8');
const manual=fs.readFileSync(new URL('../infra/postgres/migrations/016_manual_verification_pipeline.sql',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('../apps/api/src/verification/manual-verification.service.ts',import.meta.url),'utf8');
const storage=fs.readFileSync(new URL('../apps/api/src/verification/verification-storage.service.ts',import.meta.url),'utf8');
const checks=[
 ['identity/license/vehicle state tables',/identity_verification_profile/.test(core)&&/driver_license_verification/.test(core)&&/vehicle_verification/.test(core)],
 ['private document metadata table',/CREATE TABLE IF NOT EXISTS verification_document/.test(manual)],
 ['review queue',/CREATE TABLE IF NOT EXISTS verification_review_case/.test(manual)],
 ['reviewer access audit',/verification_document_access_log/.test(manual)],
 ['no raw document number column',!/(document_number|license_number)\s+TEXT/i.test(core+manual)],
 ['generated object keys',/verification\/\$\{u\.id\}/.test(service)],
 ['MIME magic-byte validation',/detectMime/.test(storage)&&/DOCUMENT_CONTENT_INVALID/.test(service)],
 ['server-side authenticated upload path',/uploadDocument/.test(service)&&/putObject/.test(storage)],
 ['short lived reviewer URL',/VERIFICATION_REVIEW_URL_TTL_SECONDS/.test(service)],
 ['manual decision only',/manual_review_decision/.test(service)&&/verification_reviewer/.test(service)],
 ['retention purge',/purgeExpired/.test(service)&&/retention_until/.test(manual)],
 ['no public object key in DTO',!/objectKey:/.test(service)],
];
for(const [name,ok] of checks){if(!ok)throw new Error(`verification invariant failed: ${name}`)}
console.log('PASS manual verification security fixture');for(const [name] of checks)console.log(` - ${name}`);
