import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiFetch, readJsonSafe } from '@/api/client';
import { useAuth } from '@/auth/auth-context';

type LiveEvent={id:number;topic:string;entityId?:string|null;createdAt:string};
type LiveValue={versions:Record<string,number>;connected:boolean;lastEventAt:string|null};
const LiveContext=createContext<LiveValue>({versions:{},connected:false,lastEventAt:null});
export function LiveProvider({children}:PropsWithChildren){
  const{user}=useAuth();const[versions,setVersions]=useState<Record<string,number>>({});const[connected,setConnected]=useState(false);const[lastEventAt,setLastEventAt]=useState<string|null>(null);const cursor=useRef<number|null>(null);
  useEffect(()=>{if(!user){cursor.current=null;setConnected(false);return}let cancelled=false;let controller:AbortController|null=null;
    const run=async()=>{while(!cancelled){if(AppState.currentState!=='active'){setConnected(false);await new Promise(r=>setTimeout(r,1200));continue}try{controller=new AbortController();const path=cursor.current===null?'/live/poll':`/live/poll?after=${cursor.current}`;const r=await apiFetch(path,{signal:controller.signal});const data=await readJsonSafe<any>(r);if(!r.ok||!data){setConnected(false);await new Promise(r=>setTimeout(r,1200));continue}cursor.current=Number(data.cursor??cursor.current??0);const events=(Array.isArray(data.events)?data.events:[]) as LiveEvent[];if(events.length){setVersions(prev=>{const next={...prev};for(const e of events)next[e.topic]=(next[e.topic]??0)+1;return next});setLastEventAt(events[events.length-1]?.createdAt??new Date().toISOString())}setConnected(true)}catch(e:any){if(e?.name!=='AbortError'){setConnected(false);await new Promise(r=>setTimeout(r,1000))}}}}
    void run();return()=>{cancelled=true;controller?.abort()};},[user?.id]);
  const value=useMemo(()=>({versions,connected,lastEventAt}),[versions,connected,lastEventAt]);return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
export function useLive(){return useContext(LiveContext)}
export function useLiveVersion(...topics:string[]){const{versions}=useLive();return topics.map(t=>versions[t]??0).join(':')}
