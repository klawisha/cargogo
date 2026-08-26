import { fetch as expoFetch } from 'expo/fetch';
import * as FileSystem from 'expo-file-system/legacy';
import { clearSession, loadSession, saveSession } from '@/auth/session-store';
import type { AuthResponse } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
let refreshPromise: Promise<AuthResponse | null> | null = null;

export async function readJsonSafe<T=any>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; }
  catch { return null; }
}


async function refresh(): Promise<AuthResponse | null> {
  const session = await loadSession();
  if (!session) return null;
  const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
  if (!response.ok) { await clearSession(); return null; }
  const next = await readJsonSafe<AuthResponse>(response);
  if (!next) { await clearSession(); return null; }
  await saveSession(next.session);
  return next;
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const session = await loadSession();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const isFormData = typeof FormData !== 'undefined' && (init.body instanceof FormData || (init.body as any)?.constructor?.name === 'FormData');
  if (init.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  const requestFetch = isFormData ? expoFetch : fetch;
  const response = await requestFetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && session?.refreshToken) {
    refreshPromise ??= refresh().finally(() => { refreshPromise = null; });
    const next = await refreshPromise;
    if (next) return apiFetch(path, init, false);
  }
  return response;
}

export async function authRequest(path: '/auth/login'|'/auth/register', payload: object): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await readJsonSafe<any>(response);
  if (!response.ok) {
    const issueMessage=Array.isArray(data?.issues)?data.issues.map((x:any)=>x?.message).filter(Boolean).join(' · '):'';
    throw new Error(issueMessage || data?.message || data?.error?.message || 'Request failed');
  }
  await saveSession(data.session);
  return data as AuthResponse;
}


export type VerificationUploadParams = {
  subjectType: 'identity' | 'driver_license' | 'vehicle';
  subjectId?: string;
  documentKind: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
};

export type NativeUploadResponse = {
  ok: boolean;
  status: number;
  data: any;
};

/**
 * Uploads an already-local file using Expo's native FileSystem multipart transport.
 * This avoids React Native Blob/FormData bridging for binary verification documents.
 */
export async function uploadVerificationDocument(
  fileUri: string,
  params: VerificationUploadParams,
  retry = true,
): Promise<NativeUploadResponse> {
  const session = await loadSession();
  if (!session?.accessToken) return { ok: false, status: 401, data: { message: 'Session required' } };

  const parameters: Record<string, string> = {
    subjectType: params.subjectType,
    documentKind: params.documentKind,
  };
  if (params.subjectId) parameters.subjectId = params.subjectId;

  const result = await FileSystem.uploadAsync(`${API_URL}/verification/documents/upload`, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: params.mimeType,
    parameters,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  let data: any = null;
  try { data = result.body ? JSON.parse(result.body) : null; } catch { data = { message: result.body || 'Upload failed' }; }

  if (result.status === 401 && retry && session.refreshToken) {
    refreshPromise ??= refresh().finally(() => { refreshPromise = null; });
    const next = await refreshPromise;
    if (next) return uploadVerificationDocument(fileUri, params, false);
  }

  return { ok: result.status >= 200 && result.status < 300, status: result.status, data };
}

export async function reportClientError(input:{message:string;stack?:string;screen?:string;errorName?:string;metadata?:Record<string,unknown>}){
  try{await apiFetch('/ops/client-error',{method:'POST',body:JSON.stringify({...input,platform:'android',appVersion:'1.6.5'})},false)}catch{}
}

export { API_URL };


export type DealEvidenceStage = 'pickup' | 'delivery';
export async function uploadDealHandoverEvidence(
  dealId: string,
  stage: DealEvidenceStage,
  fileUri: string,
  mimeType: 'image/jpeg' | 'image/png',
  note?: string,
  location?: { latitude:number; longitude:number; accuracyMeters?:number|null; capturedAt?:string|null; status:'captured'|'permission_denied'|'unavailable' },
  retry = true,
): Promise<NativeUploadResponse> {
  const session = await loadSession();
  if (!session?.accessToken) return { ok:false,status:401,data:{message:'Session required'} };
  const parameters:Record<string,string>={stage};
  if(note?.trim())parameters.note=note.trim();
  if(location){
    parameters.locationStatus=location.status;
    if(location.status==='captured'){
      parameters.latitude=String(location.latitude);
      parameters.longitude=String(location.longitude);
      if(location.accuracyMeters!==null&&location.accuracyMeters!==undefined)parameters.accuracyMeters=String(location.accuracyMeters);
      if(location.capturedAt)parameters.clientCapturedAt=location.capturedAt;
    }
  }
  const result=await FileSystem.uploadAsync(`${API_URL}/deals/${dealId}/evidence/upload`,fileUri,{
    httpMethod:'POST',uploadType:FileSystem.FileSystemUploadType.MULTIPART,fieldName:'file',mimeType,parameters,
    headers:{Accept:'application/json',Authorization:`Bearer ${session.accessToken}`},
  });
  let data:any=null;try{data=result.body?JSON.parse(result.body):null}catch{data={message:result.body||'Upload failed'}}
  if(result.status===401&&retry&&session.refreshToken){refreshPromise??=refresh().finally(()=>{refreshPromise=null});const next=await refreshPromise;if(next)return uploadDealHandoverEvidence(dealId,stage,fileUri,mimeType,note,location,false)}
  return{ok:result.status>=200&&result.status<300,status:result.status,data};
}


export async function uploadDisputePhoto(disputeId:string,fileUri:string,mimeType:'image/jpeg'|'image/png',note?:string,retry=true):Promise<NativeUploadResponse>{
  const session=await loadSession();if(!session?.accessToken)return{ok:false,status:401,data:{message:'Session required'}};
  const parameters:Record<string,string>={};if(note?.trim())parameters.note=note.trim();
  const result=await FileSystem.uploadAsync(`${API_URL}/disputes/${disputeId}/evidence/photo`,fileUri,{httpMethod:'POST',uploadType:FileSystem.FileSystemUploadType.MULTIPART,fieldName:'file',mimeType,parameters,headers:{Accept:'application/json',Authorization:`Bearer ${session.accessToken}`}});
  let data:any=null;try{data=result.body?JSON.parse(result.body):null}catch{data={message:result.body||'Upload failed'}}
  if(result.status===401&&retry&&session.refreshToken){refreshPromise??=refresh().finally(()=>{refreshPromise=null});const next=await refreshPromise;if(next)return uploadDisputePhoto(disputeId,fileUri,mimeType,note,false)}
  return{ok:result.status>=200&&result.status<300,status:result.status,data};
}
