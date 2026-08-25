import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch, readJsonSafe } from '@/api/client';
import type { CargoOffer, Trip, TripMatch } from '@/api/types';
import {colors,themedStyleSheet} from '@/theme/tokens';
import { Screen } from '@/ui/screen';
import { RoutePreview } from '@/ui/route-preview';
import {useLiveVersion} from '@/live/live-context';

function km(meters: number | null | undefined) { return meters == null ? '—' : `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} км`; }

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const live=useLiveVersion('cargo','trip','deals');
  const [trip,setTrip] = useState<Trip | null>(null);
  const [matches,setMatches] = useState<TripMatch[]>([]);
  const [sentOffers,setSentOffers] = useState<CargoOffer[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [sortMode,setSortMode] = useState<'best'|'exact'|'price'|'detour'>('best');
  const [query,setQuery]=useState('');
  const [isCurrent,setIsCurrent]=useState(false);
  const [notice,setNotice]=useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [tripResponse,matchResponse,offerResponse,currentResponse] = await Promise.all([apiFetch(`/trips/${id}`),apiFetch(`/trips/${id}/matches`),apiFetch('/offers/mine'),apiFetch('/trips/current')]);
      const tripData = await readJsonSafe<Trip>(tripResponse); const matchData = await readJsonSafe<TripMatch[]>(matchResponse); const offerData = await readJsonSafe<CargoOffer[]>(offerResponse); const currentData = await readJsonSafe<Trip>(currentResponse);
      if (!tripResponse.ok || !tripData) throw new Error((tripData as any)?.message ?? 'Не вдалося завантажити поїздку');
      if (!matchResponse.ok || !matchData) throw new Error((matchData as any)?.message ?? 'Не вдалося завантажити збіги');
      if (!offerResponse.ok || !offerData) throw new Error((offerData as any)?.message ?? 'Не вдалося завантажити пропозиції');
      if (!currentResponse.ok) throw new Error((currentData as any)?.message ?? 'Не вдалося перевірити поточний маршрут');
      setTrip(tripData); setMatches(matchData); setSentOffers(offerData); setIsCurrent(currentData?.id===String(id));
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { setLoading(false); }
  },[id]);

  useEffect(() => { void load(); },[load]);

  async function makeCurrent() {
    if (!id || isCurrent || loading) return;
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await apiFetch(`/trips/${id}/current`,{method:'POST'});
      const data = await readJsonSafe<Trip>(response);
      if (!response.ok || !data) throw new Error((data as any)?.message ?? 'Не вдалося зробити маршрут поточним');
      if (data.id !== String(id)) throw new Error('Сервер повернув інший поточний маршрут');
      setTrip(data);
      setIsCurrent(true);
      setNotice('Маршрут збережено як поточний. Саме його CargoGo використовуватиме для matching, доки ви не оберете інший.');
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зробити маршрут поточним');
    } finally {
      setLoading(false);
    }
  }


  function removeTrip(){if(!id)return;Alert.alert('Видалити поїздку?','Дозволено лише до прийняття угоди. Очікуючі пропозиції буде анульовано.',[{text:'Скасувати',style:'cancel'},{text:'Видалити',style:'destructive',onPress:async()=>{setLoading(true);try{const r=await apiFetch(`/trips/${id}`,{method:'DELETE'});const d=await r.json();if(!r.ok)throw new Error(d?.message??'Не вдалося видалити');router.replace('/(tabs)')}catch(e){setError(e instanceof Error?e.message:'Помилка');setLoading(false)}}}]);}

  async function quickOffer(match: TripMatch) {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/offers',{method:'POST',body:JSON.stringify({cargoId:match.cargo.id,tripId:String(id),amountMinor:match.cargo.rewardMinor,currency:'UAH'})});
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? 'Не вдалося прийняти ціну');
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { setLoading(false); }
  }

  async function refreshMatches() {
    if (!id) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/trips/${id}/matches/refresh`,{method:'POST'});
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? 'Не вдалося оновити');
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка'); setLoading(false); }
  }

  const q=query.trim().toLocaleLowerCase('uk-UA');const visibleMatches=[...matches].filter(m=>(sortMode!=='exact'||m.matchKind==='exact_city_pair')&&(!q||`${m.cargo.title} ${m.cargo.pickupLabel} ${m.cargo.deliveryLabel}`.toLocaleLowerCase('uk-UA').includes(q))).sort((a,b)=>sortMode==='price'?b.cargo.rewardMinor-a.cargo.rewardMinor:sortMode==='detour'?(a.estimatedExtraM??1e15)-(b.estimatedExtraM??1e15):b.score-a.score);

  return <Screen><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:30}}>
    <View style={s.header}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>←</Text></Pressable><View><Text style={s.eye}>ПОЇЗДКА</Text><Text style={s.title}>{trip ? `${trip.origin.publicLabel} → ${trip.destination.publicLabel}` : 'Завантаження...'}</Text></View></View>
    {!!error && <Text style={s.error}>{error}</Text>}
    {trip && <>
      <View style={s.summary}><View style={s.row}><View><Text style={s.eye}>МАРШРУТ</Text><Text style={s.big}>{km(trip.route.distanceM)}</Text></View><View style={s.right}><Text style={s.eye}>ВІДХИЛЕННЯ</Text><Text style={s.big}>{trip.maxDetourKm} км</Text></View></View><View style={s.rule}/><Text style={s.meta}>{trip.vehicle.label ?? 'Авто'} · {trip.capacity.kg ?? '—'} кг · {trip.route.quality.toUpperCase()}</Text><View style={{marginTop:14}}><RoutePreview compact origin={trip.origin.publicLabel} destination={trip.destination.publicLabel} distance={km(trip.route.distanceM)}/></View>{['draft','published'].includes(trip.status)&&<><Pressable disabled={isCurrent||loading} onPress={makeCurrent} style={[s.currentButton,isCurrent&&s.currentButtonActive,(isCurrent||loading)&&{opacity:.82}]}><View><Text style={[s.currentButtonText,isCurrent&&s.currentButtonTextActive]}>{isCurrent?'ПОТОЧНИЙ ДЛЯ MATCHING':'ЗРОБИТИ ПОТОЧНИМ ДЛЯ MATCHING'}</Text>{isCurrent&&<Text style={s.currentButtonSub}>Цей напрямок збережено між запусками застосунку</Text>}</View><Text style={[s.currentButtonText,isCurrent&&s.currentButtonTextActive]}>{isCurrent?'✓':'◎'}</Text></Pressable>{!!notice&&<Text style={s.notice}>{notice}</Text>}<View style={s.manage}><Pressable onPress={()=>router.push({pathname:'/edit-trip/[id]',params:{id:String(id)}})} style={s.manageButton}><Text style={s.manageText}>РЕДАГУВАТИ</Text></Pressable><Pressable onPress={removeTrip} style={s.deleteButton}><Text style={s.deleteText}>ВИДАЛИТИ</Text></Pressable></View></>}</View>
      <View style={s.sectionHeader}><View><Text style={s.eye}>ПІДХОДЯЩІ ВАНТАЖІ</Text><Text style={s.sectionTitle}>{visibleMatches.length ? `${visibleMatches.length} знайдено` : 'Поки немає'}</Text></View><Pressable onPress={refreshMatches}><Text style={s.action}>{loading?'...':'ОНОВИТИ'}</Text></Pressable></View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Пошук за вантажем або містом" placeholderTextColor={colors.muted} style={s.search}/><View style={s.sorts}><Pressable onPress={()=>setSortMode('best')} style={[s.sortChip,sortMode==='best'&&s.sortActive]}><Text style={[s.sortText,sortMode==='best'&&s.sortTextActive]}>КРАЩІ</Text></Pressable><Pressable onPress={()=>setSortMode('exact')} style={[s.sortChip,sortMode==='exact'&&s.sortActive]}><Text style={[s.sortText,sortMode==='exact'&&s.sortTextActive]}>ТОЧНІ МІСТА</Text></Pressable><Pressable onPress={()=>setSortMode('price')} style={[s.sortChip,sortMode==='price'&&s.sortActive]}><Text style={[s.sortText,sortMode==='price'&&s.sortTextActive]}>ЦІНА</Text></Pressable><Pressable onPress={()=>setSortMode('detour')} style={[s.sortChip,sortMode==='detour'&&s.sortActive]}><Text style={[s.sortText,sortMode==='detour'&&s.sortTextActive]}>МІН. ГАК</Text></Pressable></View>
      {visibleMatches.map((match) => <View key={match.cargo.id} style={s.card}>
        <View style={s.row}><Text style={s.cargoTitle}>{match.cargo.title}</Text><Text style={s.price}>+{Math.round(match.cargo.rewardMinor/100)} ₴</Text></View>
        <Text style={s.meta}>{match.cargo.pickupLabel} → {match.cargo.deliveryLabel}</Text>{match.cargo.declaredValueMinor!=null&&<Text style={s.meta}>Оціночна вартість: {Math.round(match.cargo.declaredValueMinor/100).toLocaleString('uk-UA')} ₴ · не є страховою сумою</Text>}
        <View style={s.metrics}><View><Text style={s.metricLabel}>{match.matchKind==='exact_city_pair'?'ТОЧНІ МІСТА':'MATCH'}</Text><Text style={s.metric}>{match.score}/100</Text></View><View><Text style={s.metricLabel}>CORRIDOR</Text><Text style={s.metric}>{km(match.estimatedExtraM)}</Text></View><View><Text style={s.metricLabel}>ВАГА</Text><Text style={s.metric}>{match.cargo.weightKg ? `${match.cargo.weightKg} кг` : '—'}</Text></View></View>
        {match.pickupEta&&<Text style={s.eta}>Орієнтовно біля точки забору: {new Date(match.pickupEta).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</Text>}<Text style={s.privateNote}>Score: міста {match.scoreBreakdown.city} · близькість {match.scoreBreakdown.proximity} · час {match.scoreBreakdown.time} · місткість {match.scoreBreakdown.capacity}. Точні адреси приховані до угоди.</Text>
        {(()=>{const own=sentOffers.find(o=>o.cargoId===match.cargo.id&&o.tripId===id&&o.status==='pending');const pendingAmount=own?.amountMinor??(match.myOfferStatus==='pending'?match.myOfferAmountMinor:null);return pendingAmount!=null ? <Pressable onPress={()=>router.push({pathname:'/offer/new',params:{cargoId:match.cargo.id,tripId:String(id),rewardMinor:String(pendingAmount),title:match.cargo.title}})} style={({pressed})=>[s.offerButton,pressed&&{opacity:.65}]}><Text style={s.offerButtonText}>{`ЗМІНИТИ ПРОПОЗИЦІЮ · ${Math.round(pendingAmount/100)} ₴`}</Text><Text style={s.offerButtonText}>→</Text></Pressable> : <View style={s.offerActions}><Pressable disabled={loading} onPress={()=>quickOffer(match)} style={s.quickButton}><Text style={s.quickText}>ВЗЯТИ ЗА {Math.round(match.cargo.rewardMinor/100)} ₴</Text></Pressable><Pressable onPress={()=>router.push({pathname:'/offer/new',params:{cargoId:match.cargo.id,tripId:String(id),rewardMinor:String(match.cargo.rewardMinor),title:match.cargo.title}})} style={s.counterButton}><Text style={s.offerButtonText}>СВОЯ ЦІНА →</Text></Pressable></View>})()}
      </View>)}
      {!visibleMatches.length && !loading && <View style={s.empty}><Text style={s.emptyTitle}>Нічого достатньо близького</Text><Text style={s.meta}>Збільште допустиме відхилення в наступній поїздці або оновіть пізніше. Matching не показує вантажі, що не вміщаються за заявленими параметрами.</Text></View>}
    </>}
  </ScrollView></Screen>;
}

const s=themedStyleSheet(()=>({header:{minHeight:84,flexDirection:'row',alignItems:'center',gap:15,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:40,height:40,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:20,fontWeight:'900'},eye:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.3},title:{color:colors.text,fontSize:19,fontWeight:'900',marginTop:4},error:{color:colors.danger,fontSize:12,marginTop:10},summary:{marginTop:12,padding:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},row:{flexDirection:'row',justifyContent:'space-between',gap:12},right:{alignItems:'flex-end'},big:{color:colors.text,fontSize:22,fontWeight:'900',marginTop:4},rule:{height:1,backgroundColor:colors.border,marginVertical:12},meta:{color:colors.textSecondary,fontSize:11,lineHeight:17},sectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:20,marginBottom:8},sectionTitle:{color:colors.text,fontSize:20,fontWeight:'900',marginTop:3},action:{color:colors.accent,fontSize:10,fontWeight:'900'},card:{padding:16,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,backgroundColor:colors.surface,marginBottom:8},cargoTitle:{color:colors.text,fontSize:16,fontWeight:'900',flex:1},price:{color:colors.accent,fontSize:18,fontWeight:'900'},metrics:{flexDirection:'row',justifyContent:'space-between',marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:colors.border},metricLabel:{color:colors.muted,fontSize:8,fontWeight:'900',letterSpacing:1},metric:{color:colors.text,fontSize:13,fontWeight:'900',marginTop:4},eta:{color:colors.textSecondary,fontSize:10,fontWeight:'800',marginTop:10},privateNote:{color:colors.muted,fontSize:10,marginTop:13},offerButton:{minHeight:46,borderWidth:1,borderColor:colors.accent,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:13,marginTop:12},offerButtonText:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:.7},offerActions:{flexDirection:'row',gap:8,marginTop:12},quickButton:{flex:1,minHeight:46,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',paddingHorizontal:8},quickText:{color:colors.accentText,fontSize:9,fontWeight:'900'},counterButton:{flex:1,minHeight:46,borderWidth:1,borderColor:colors.accent,alignItems:'center',justifyContent:'center',paddingHorizontal:8},search:{height:44,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:12,marginBottom:8},sorts:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:8},sortChip:{borderWidth:1,borderColor:colors.border,paddingHorizontal:9,paddingVertical:7},sortActive:{borderColor:colors.accent},sortText:{color:colors.textSecondary,fontSize:8,fontWeight:'900'},sortTextActive:{color:colors.accent},currentButton:{minHeight:42,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surfaceRaised,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12,marginTop:13},currentButtonText:{color:colors.accent,fontSize:9,fontWeight:'900'},currentButtonActive:{backgroundColor:colors.accentSoft,borderColor:colors.success},currentButtonTextActive:{color:colors.success},currentButtonSub:{color:colors.textSecondary,fontSize:8,fontWeight:'700',marginTop:4},notice:{color:colors.success,fontSize:10,lineHeight:15,fontWeight:'800',marginTop:8},manage:{flexDirection:'row',gap:8,marginTop:13},manageButton:{flex:1,minHeight:42,borderWidth:1,borderColor:colors.accent,alignItems:'center',justifyContent:'center'},manageText:{color:colors.accent,fontSize:9,fontWeight:'900'},deleteButton:{flex:1,minHeight:42,borderWidth:1,borderColor:colors.danger,alignItems:'center',justifyContent:'center'},deleteText:{color:colors.danger,fontSize:9,fontWeight:'900'},empty:{padding:18,borderWidth:1,borderColor:colors.border},emptyTitle:{color:colors.text,fontSize:15,fontWeight:'900',marginBottom:6}}));
