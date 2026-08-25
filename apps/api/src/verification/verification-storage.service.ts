import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';

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
