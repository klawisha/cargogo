import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const unreserved=/^[A-Za-z0-9\-_.~]$/;
function awsEncode(value:string){return Array.from(Buffer.from(value,'utf8')).map((b)=>{const c=String.fromCharCode(b);return unreserved.test(c)?c:`%${b.toString(16).toUpperCase().padStart(2,'0')}`}).join('')}
function encodeKey(key:string){return key.split('/').map(awsEncode).join('/')}
function hmac(key:Buffer|string,data:string){return createHmac('sha256',key).update(data).digest()}
function hash(data:string|Buffer){return createHash('sha256').update(data).digest('hex')}
function amzDate(d:Date){return d.toISOString().replace(/[:-]|\.\d{3}/g,'')}

@Injectable()
export class VerificationStorageService{
  constructor(@Inject(ConfigService) private readonly config:ConfigService){}
  private endpoint(){return new URL(this.config.getOrThrow<string>('S3_ENDPOINT'))}
  private bucket(){return this.config.getOrThrow<string>('S3_BUCKET')}
  private region(){return this.config.getOrThrow<string>('S3_REGION')}
  private access(){return this.config.getOrThrow<string>('S3_ACCESS_KEY')}
  private secret(){return this.config.getOrThrow<string>('S3_SECRET_KEY')}

  presign(method:'PUT'|'GET'|'HEAD'|'DELETE',key:string,ttlSeconds:number){
    const now=new Date();const endpoint=this.endpoint();const date=amzDate(now);const day=date.slice(0,8);const scope=`${day}/${this.region()}/s3/aws4_request`;
    const uri=`/${awsEncode(this.bucket())}/${encodeKey(key)}`;
    const query:Record<string,string>={
      'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':`${this.access()}/${scope}`,'X-Amz-Date':date,
      'X-Amz-Expires':String(ttlSeconds),'X-Amz-SignedHeaders':'host',
    };
    const canonicalQuery=Object.keys(query).sort().map(k=>`${awsEncode(k)}=${awsEncode(query[k])}`).join('&');
    const host=endpoint.host;const canonical=`${method}\n${uri}\n${canonicalQuery}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const stringToSign=`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`;
    const kDate=hmac(`AWS4${this.secret()}`,day),kRegion=hmac(kDate,this.region()),kService=hmac(kRegion,'s3'),kSigning=hmac(kService,'aws4_request');
    const signature=createHmac('sha256',kSigning).update(stringToSign).digest('hex');
    endpoint.pathname=uri;endpoint.search=`${canonicalQuery}&X-Amz-Signature=${signature}`;return endpoint.toString();
  }


  private proxySecret(){return this.config.get<string>('FILE_PROXY_SIGNING_SECRET')?.trim()||this.secret()}

  createProxyToken(key:string,ttlSeconds:number){
    const payload=Buffer.from(JSON.stringify({v:1,k:key,e:Math.floor(Date.now()/1000)+Math.max(1,ttlSeconds)}),'utf8').toString('base64url');
    const signature=createHmac('sha256',this.proxySecret()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  verifyProxyToken(token:string){
    const [payload,signature,extra]=token.split('.');
    if(!payload||!signature||extra)throw new BadRequestException({code:'FILE_ACCESS_TOKEN_INVALID',message:'File access token is invalid'});
    const expected=createHmac('sha256',this.proxySecret()).update(payload).digest('base64url');
    const a=Buffer.from(signature),b=Buffer.from(expected);
    if(a.length!==b.length||!timingSafeEqual(a,b))throw new BadRequestException({code:'FILE_ACCESS_TOKEN_INVALID',message:'File access token is invalid'});
    let parsed:any;
    try{parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))}catch{throw new BadRequestException({code:'FILE_ACCESS_TOKEN_INVALID',message:'File access token is invalid'})}
    if(parsed?.v!==1||typeof parsed?.k!=='string'||!parsed.k||!Number.isFinite(parsed?.e))throw new BadRequestException({code:'FILE_ACCESS_TOKEN_INVALID',message:'File access token is invalid'});
    if(parsed.e<Math.floor(Date.now()/1000))throw new BadRequestException({code:'FILE_ACCESS_TOKEN_EXPIRED',message:'File access token has expired'});
    return parsed.k as string;
  }

  proxyUrl(key:string,ttlSeconds:number,publicBaseUrl:string){
    const base=publicBaseUrl.replace(/\/+$/,'');
    return `${base}/v1/files/object?token=${encodeURIComponent(this.createProxyToken(key,ttlSeconds))}`;
  }

  async getObject(key:string){
    let response:Response;
    try{response=await fetch(this.presign('GET',key,60),{method:'GET'})}catch{throw new ServiceUnavailableException({code:'FILE_STORAGE_UNAVAILABLE',message:'File storage is temporarily unavailable'})}
    if(response.status===404)throw new BadRequestException({code:'FILE_NOT_FOUND',message:'File was not found'});
    if(!response.ok)throw new ServiceUnavailableException({code:'FILE_STORAGE_READ_FAILED',message:'File storage could not read the requested file',status:response.status});
    const bytes=Buffer.from(await response.arrayBuffer());
    const mimeType=(response.headers.get('content-type')??this.detectMime(bytes)).split(';')[0].trim().toLowerCase();
    return {bytes,mimeType};
  }

  detectMime(b:Buffer){
    if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return'image/jpeg';
    if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return'image/png';
    if(b.length>=5&&b.subarray(0,5).toString('ascii')==='%PDF-')return'application/pdf';
    return'application/octet-stream';
  }

  async putObject(key:string,bytes:Buffer,mimeType:string){
    const detected=this.detectMime(bytes);
    if(detected!==mimeType)throw new BadRequestException({code:'DOCUMENT_CONTENT_INVALID',message:'Uploaded file content does not match the declared type'});
    let response:Response;
    try{
      response=await fetch(this.presign('PUT',key,60),{method:'PUT',headers:{'Content-Type':mimeType},body:new Uint8Array(bytes)});
    }catch{
      throw new ServiceUnavailableException({code:'VERIFICATION_STORAGE_UNAVAILABLE',message:'Verification storage is temporarily unavailable'});
    }
    if(!response.ok){
      throw new ServiceUnavailableException({code:'VERIFICATION_STORAGE_REJECTED',message:'Verification storage rejected the upload',status:response.status});
    }
  }

  async inspectObject(key:string){
    const head=await fetch(this.presign('HEAD',key,60),{method:'HEAD'});
    if(!head.ok)throw new BadRequestException({code:'UPLOAD_NOT_FOUND',message:'Uploaded object was not found'});
    const size=Number(head.headers.get('content-length')??'0');const declared=(head.headers.get('content-type')??'application/octet-stream').split(';')[0].trim().toLowerCase();
    const prefix=await fetch(this.presign('GET',key,60),{headers:{Range:'bytes=0-4095'}});
    if(!prefix.ok)throw new BadRequestException({code:'UPLOAD_READ_FAILED',message:'Uploaded object could not be validated'});
    const bytes=Buffer.from(await prefix.arrayBuffer());
    return {size,declared,detected:this.detectMime(bytes)};
  }
  async deleteObject(key:string){const r=await fetch(this.presign('DELETE',key,60),{method:'DELETE'});if(!r.ok&&r.status!==404)throw new Error(`S3 delete failed: ${r.status}`)}
}
