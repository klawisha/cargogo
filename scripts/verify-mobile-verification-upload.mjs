import fs from 'node:fs';
const screen=fs.readFileSync('apps/mobile/app/verification.tsx','utf8');
const client=fs.readFileSync('apps/mobile/src/api/client.ts','utf8');
const must=[
  ['picker cache materialization',screen.includes('copyToCacheDirectory:true')],
  ['direct picker URI upload',screen.includes('uploadVerificationDocument(a.uri')],
  ['no redundant staging copy',!screen.includes('FileSystem.copyAsync')],
  ['no redundant local getInfo',!screen.includes('FileSystem.getInfoAsync')],
  ['native multipart upload',client.includes('FileSystem.uploadAsync')&&client.includes('FileSystemUploadType.MULTIPART')],
  ['auth upload',client.includes('Authorization: `Bearer ${session.accessToken}`')],
  ['client size guard',screen.includes("a.size>10*1024*1024")],
  ['no verification FormData',!screen.includes('new FormData()')],
  ['no File URI constructor',!screen.includes('new File(a.uri)')],
  ['no Response.blob',!screen.includes('Response.blob')&&!client.includes('.blob()')],
];
const failed=must.filter(([,ok])=>!ok);
if(failed.length){console.error(failed.map(([x])=>`FAIL ${x}`).join('\n'));process.exit(1)}
console.log('PASS mobile verification direct native upload fixture');
