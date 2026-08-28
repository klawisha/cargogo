import type { Request } from 'express';

function firstHeader(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value}
export function publicBaseUrl(req:Request){
  const forwardedProto=firstHeader(req.headers['x-forwarded-proto']);
  const forwardedHost=firstHeader(req.headers['x-forwarded-host']);
  const proto=(forwardedProto?.split(',')[0]?.trim()||req.protocol||'http').replace(/[^a-z]/gi,'');
  const host=(forwardedHost?.split(',')[0]?.trim()||req.get('host')||'localhost:3000').replace(/[\r\n]/g,'');
  return `${proto}://${host}`;
}
