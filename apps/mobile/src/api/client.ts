import { fetch as expoFetch } from 'expo/fetch';
import * as FileSystem from 'expo-file-system/legacy';
import { clearSession, loadSession, saveSession } from '@/auth/session-store';
import { DEFAULT_API_URL, endpointHeaders, getApiUrl } from './api-endpoint-store';
import type { AuthResponse } from './types';

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
  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...endpointHeaders(apiUrl) }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
  if (!response.ok) { await clearSession(); return null; }
  const next = await readJsonSafe<AuthResponse>(response);
  if (!next) { await clearSession(); return null; }
  await saveSession(next.session);
  return next;
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const session = await loadSession();
  const apiUrl = await getApiUrl();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  for (const [key, value] of Object.entries(endpointHeaders(apiUrl))) if (!headers.has(key)) headers.set(key, value);
  const isFormData = typeof FormData !== 'undefined' && (init.body instanceof FormData || (init.body as any)?.constructor?.name === 'FormData');
  if (init.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  const requestFetch = isFormData ? expoFetch : fetch;
  const response = await requestFetch(`${apiUrl}${path}`, { ...init, headers });
  if (response.status === 401 && retry && session?.refreshToken) {
    refreshPromise ??= refresh().finally(() => { refreshPromise = null; });
    const next = await refreshPromise;
    if (next) return apiFetch(path, init, false);
  }
  return response;
}

export async function authRequest(path: '/auth/login'|'/auth/register', payload: object): Promise<AuthResponse> {
  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...endpointHeaders(apiUrl) }, body: JSON.stringify(payload) });
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

export type NativeUploadResponse = { ok: boolean; status: number; data: any; };

export async function uploadVerificationDocument(fileUri: string, params: VerificationUploadParams, retry = true): Promise<NativeUploadResponse> {
  const session = await loadSession();
  if (!session?.accessToken) return { ok: false, status: 401, data: { message: 'Session required' } };
  const apiUrl = await getApiUrl();
  const parameters: Record<string, string> = { subjectType: params.subjectType, documentKind: params.documentKind };
  if (params.subjectId) parameters.subjectId = params.subjectId;
  const result = await FileSystem.uploadAsync(`${apiUrl}/verification/documents/upload`, fileUri, {
    httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.MULTIPART, fieldName: 'file', mimeType: params.mimeType, parameters,
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.accessToken}`, ...endpointHeaders(apiUrl) },
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
  try{await apiFetch('/ops/client-error',{method:'POST',body:JSON.stringify({...input,platform:'android',appVersion:'1.8.0'})},false)}catch{}
}

export async function downloadAuthenticatedFile(path:string,fileName:string){
  const session=await loadSession();if(!session?.accessToken)throw new Error('Session required');
  const apiUrl=await getApiUrl();const dir=FileSystem.cacheDirectory??FileSystem.documentDirectory;if(!dir)throw new Error('File storage unavailable');
  const uri=`${dir}${fileName}`;const result=await FileSystem.downloadAsync(`${apiUrl}${path}`,uri,{headers:{Authorization:`Bearer ${session.accessToken}`,...endpointHeaders(apiUrl)}});
  if(result.status<200||result.status>=300)throw new Error(`Export failed: HTTP ${result.status}`);
  return{uri:result.uri,contentUri:await FileSystem.getContentUriAsync(result.uri)};
}

export { DEFAULT_API_URL as API_URL };

export type DealEvidenceStage = 'pickup' | 'delivery';
export async function uploadDealHandoverEvidence(
  dealId: string, stage: DealEvidenceStage, fileUri: string, mimeType: 'image/jpeg' | 'image/png', note?: string,
  location?: { latitude:number; longitude:number; accuracyMeters?:number|null; capturedAt?:string|null; status:'captured'|'permission_denied'|'unavailable' }, retry = true,
): Promise<NativeUploadResponse> {
  const session = await loadSession();
  if (!session?.accessToken) return {ok:false,status:401,data:{message:'Session required'}};
  const apiUrl = await getApiUrl();
  const parameters:Record<string,string>={stage};
  if(note?.trim())parameters.note=note.trim();
  if(location){ parameters.locationStatus=location.status; if(location.status==='captured'){ parameters.latitude=String(location.latitude); parameters.longitude=String(location.longitude); if(location.accuracyMeters!==null&&location.accuracyMeters!==undefined)parameters.accuracyMeters=String(location.accuracyMeters); if(location.capturedAt)parameters.clientCapturedAt=location.capturedAt; } }
  const result=await FileSystem.uploadAsync(`${apiUrl}/deals/${dealId}/evidence/upload`,fileUri,{httpMethod:'POST',uploadType:FileSystem.FileSystemUploadType.MULTIPART,fieldName:'file',mimeType,parameters,headers:{Accept:'application/json',Authorization:`Bearer ${session.accessToken}`,...endpointHeaders(apiUrl)}});
  let data:any=null;try{data=result.body?JSON.parse(result.body):null}catch{data={message:result.body||'Upload failed'}}
  if(result.status===401&&retry&&session.refreshToken){refreshPromise??=refresh().finally(()=>{refreshPromise=null});const next=await refreshPromise;if(next)return uploadDealHandoverEvidence(dealId,stage,fileUri,mimeType,note,location,false)}
  return{ok:result.status>=200&&result.status<300,status:result.status,data};
}

export async function uploadDisputePhoto(disputeId:string,fileUri:string,mimeType:'image/jpeg'|'image/png',note?:string,retry=true):Promise<NativeUploadResponse>{
  const session=await loadSession();if(!session?.accessToken)return{ok:false,status:401,data:{message:'Session required'}};
  const apiUrl=await getApiUrl();const parameters:Record<string,string>={};if(note?.trim())parameters.note=note.trim();
  const result=await FileSystem.uploadAsync(`${apiUrl}/disputes/${disputeId}/evidence/photo`,fileUri,{httpMethod:'POST',uploadType:FileSystem.FileSystemUploadType.MULTIPART,fieldName:'file',mimeType,parameters,headers:{Accept:'application/json',Authorization:`Bearer ${session.accessToken}`,...endpointHeaders(apiUrl)}});
  let data:any=null;try{data=result.body?JSON.parse(result.body):null}catch{data={message:result.body||'Upload failed'}}
  if(result.status===401&&retry&&session.refreshToken){refreshPromise??=refresh().finally(()=>{refreshPromise=null});const next=await refreshPromise;if(next)return uploadDisputePhoto(disputeId,fileUri,mimeType,note,false)}
  return{ok:result.status>=200&&result.status<300,status:result.status,data};
}
