import fs from 'node:fs';
function text(p){return fs.readFileSync(p,'utf8')}
const mobile=text('apps/mobile/app/verification.tsx');
const api=text('apps/api/src/verification/manual-verification.service.ts');
const controller=text('apps/api/src/verification/manual-verification.controller.ts');
const client=text('apps/mobile/src/api/client.ts');
const verification=text('apps/api/src/verification/verification.service.ts');
const types=text('apps/mobile/src/api/types.ts');
const checks=[
  ['mobile does not use Response.blob()',!mobile.includes('.blob()')],
  ['mobile uses authenticated native multipart upload',client.includes('/verification/documents/upload')&&client.includes('FileSystem.uploadAsync')&&client.includes('FileSystemUploadType.MULTIPART')&&client.includes('Authorization: `Bearer ${session.accessToken}`')],
  ['apiFetch preserves multipart boundary',client.includes('isFormData')],
  ['API has multipart endpoint',controller.includes("@Post('documents/upload')")&&controller.includes('FileInterceptor')],
  ['legacy direct upload route removed',!controller.includes("documents/upload-url")&&!controller.includes("documents/:id/confirm")],
  ['API magic-byte validates before storage',api.includes('this.storage.detectMime(file.buffer)')],
  ['API limits upload abuse',api.includes('VERIFICATION_UPLOAD_RATE_LIMIT')],
  ['readiness is independent from enforcement',verification.includes('readiness:{')&&verification.includes("senderReady:identityDto.status==='verified'")],
  ['mobile state has readiness contract',types.includes('readiness:{senderReady:boolean;driverReady:boolean}')],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length)process.exit(1);
console.log('PASS verification upload reliability fixture');
