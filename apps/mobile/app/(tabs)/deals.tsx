import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/api/client';
import type { Deal } from '@/api/types';
import {colors,radii,themedStyleSheet} from '@/theme/tokens';
import { Screen } from '@/ui/screen';
import {useLiveVersion} from '@/live/live-context';

export default function Deals(){
  const live=useLiveVersion('deals');
  const[deals,setDeals]=useState<Deal[]>([]);const[error,setError]=useState('');const[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await apiFetch('/deals/mine');const d=await r.json();if(!r.ok)throw new Error(d?.message??'Не вдалося завантажити угоди');setDeals(d);}catch(e){setError(e instanceof Error?e.message:'Помилка');}finally{setLoading(false);}},[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  useEffect(()=>{void load()},[live,load]);
  return <Screen><View style={s.header}><View><Text style={s.eye}>УГОДИ</Text><Text style={s.title}>{deals.length?`${deals.length} угод`:'Поки немає угод'}</Text></View><Pressable onPress={load}><Text style={s.action}>{loading?'...':'ОНОВИТИ'}</Text></Pressable></View>{!!error&&<Text style={s.error}>{error}</Text>}<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:12,paddingBottom:110}}>{deals.map(d=><Pressable key={d.id} onPress={()=>router.push({pathname:'/deal/[id]',params:{id:d.id}})} style={({pressed})=>[s.card,pressed&&{opacity:.65}]}><View style={s.row}><Text style={s.cargo}>{d.cargo.title}</Text><Text style={s.price}>{Math.round(d.agreedAmountMinor/100)} ₴</Text></View><Text style={s.route}>{d.cargo.pickupLabel} → {d.cargo.deliveryLabel}</Text><View style={[s.row,{marginTop:10}]}><Text style={s.status}>{d.status.replaceAll('_',' ').toUpperCase()}</Text><Text style={s.meta}>{d.role==='sender'?'ВІДПРАВНИК':'ПЕРЕВІЗНИК'}</Text></View></Pressable>)}{!deals.length&&!loading&&<View style={s.empty}><Text style={s.emptyTitle}>Marketplace готовий до угод</Text><Text style={s.text}>Коли власник вантажу прийме пропозицію водія, угода з’явиться тут. У development доступна server-side mock оплата для повного Alpha-flow. У production цей режим жорстко заборонений.</Text></View>}</ScrollView></Screen>;
}
const s=themedStyleSheet(()=>({header:{minHeight:82,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.border},eye:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.4},title:{color:colors.text,fontSize:25,fontWeight:'900',marginTop:5},action:{color:colors.accent,fontSize:10,fontWeight:'900'},error:{color:colors.danger,fontSize:12,marginTop:10},card:{padding:15,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:radii.md,marginBottom:9},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},cargo:{color:colors.text,fontSize:16,fontWeight:'900',flex:1},price:{color:colors.accent,fontSize:18,fontWeight:'900'},route:{color:colors.textSecondary,fontSize:11,marginTop:6},status:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:.8},meta:{color:colors.muted,fontSize:9,fontWeight:'800'},empty:{marginTop:20,padding:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:radii.lg},emptyTitle:{color:colors.text,fontSize:16,fontWeight:'900'},text:{color:colors.textSecondary,fontSize:12,lineHeight:19,marginTop:8}}));
