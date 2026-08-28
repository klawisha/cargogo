import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const storage=read('apps/api/src/verification/verification-storage.service.ts');
const proxy=read('apps/api/src/verification/file-proxy.controller.ts');
const verification=read('apps/api/src/verification/manual-verification.service.ts');
const deals=read('apps/api/src/deals/deal.service.ts');
const disputes=read('apps/api/src/disputes/dispute.service.ts');
const mobile=read('apps/mobile/src/api/client.ts');
const checks=[
 ['signed API proxy token exists',storage.includes('createProxyToken')&&storage.includes('verifyProxyToken')&&storage.includes("createHmac('sha256'" )],
 ['proxy reads S3 server-side',storage.includes("fetch(this.presign('GET',key,60)")],
 ['public API proxy endpoint exists',proxy.includes("@Get('object')")&&proxy.includes("Cache-Control")],
 ['verification access no longer exposes S3 URL',verification.includes('storage.proxyUrl')&&!verification.includes("return{url:this.storage.presign('GET'" )],
 ['handover evidence access no longer exposes S3 URL',deals.includes('evidenceStorage.proxyUrl')&&!deals.includes("url: this.evidenceStorage.presign('GET'" )],
 ['dispute evidence access no longer exposes S3 URL',disputes.includes('storage.proxyUrl')&&!disputes.includes("return{url:this.storage.presign('GET'" )],
 ['uploads already go through authenticated API multipart',mobile.includes('/verification/documents/upload')&&mobile.includes('/evidence/upload')&&mobile.includes('/evidence/photo')],
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}
if(fail)process.exit(1);
