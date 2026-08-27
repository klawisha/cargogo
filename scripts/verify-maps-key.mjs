import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
const key=(process.env.GOOGLE_MAPS_ANDROID_API_KEY??'').trim();
if(!key){console.error('FAIL: GOOGLE_MAPS_ANDROID_API_KEY is not visible in this environment.');process.exit(1)}
const fp=crypto.createHash('sha256').update(key).digest('hex').slice(0,12);
const mobile=path.resolve('apps/mobile');
const require=createRequire(import.meta.url);
const configFactory=require(path.join(mobile,'app.config.js'));
const old=process.cwd();process.chdir(mobile);
let config;try{config=typeof configFactory==='function'?configFactory():configFactory}finally{process.chdir(old)}
const injected=config?.android?.config?.googleMaps?.apiKey;
if(!injected){console.error('FAIL: app.config.js did not inject android.config.googleMaps.apiKey.');process.exit(1)}
if(injected!==key){console.error('FAIL: injected Maps key differs from environment value.');process.exit(1)}
console.log('GOOGLE MAPS BUILD KEY: PASS');
console.log(`source: ${process.env.EAS_BUILD_PROFILE?'EAS build':(process.env.EAS_BUILD?'EAS':'current environment')}`);
console.log(`length: ${key.length}`);
console.log(`sha256 fingerprint: ${fp}`);
console.log('app.config.js injection: PASS');
console.log('The key itself is intentionally not printed.');
