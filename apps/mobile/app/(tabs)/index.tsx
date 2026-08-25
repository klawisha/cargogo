import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch, readJsonSafe } from '@/api/client';
import type { Cargo, Trip } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import {colors,radii,themedStyleSheet} from '@/theme/tokens';
import { Screen } from '@/ui/screen';
import { WaitingPulse } from '@/ui/waiting-pulse';
import { BrandLogo } from '@/ui/brand-logo';
import { FadeInView, PulseDot } from '@/ui/motion';
import { RoutePreview } from '@/ui/route-preview';
import { useLive, useLiveVersion } from '@/live/live-context';

function distanceLabel(meters: number | null) {
  if (meters == null) return 'route rough';
  return meters >= 100_000 ? `${Math.round(meters / 1000)} км` : `${(meters / 1000).toFixed(1)} км`;
}

export default function Home() {
  const { user } = useAuth();
  const [cargo,setCargo] = useState<Cargo[]>([]);
  const [trips,setTrips] = useState<Trip[]>([]);
  const [currentTrip,setCurrentTrip] = useState<Trip|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const liveVersion=useLiveVersion('cargo','trip','deals');const{connected}=useLive();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [cargoResponse,tripResponse,currentResponse] = await Promise.all([apiFetch('/cargo/mine'),apiFetch('/trips/mine'),apiFetch('/trips/current')]);
      const cargoData = await cargoResponse.json(); const tripData = await tripResponse.json(); const currentData = await readJsonSafe<Trip>(currentResponse);
      if (!cargoResponse.ok) throw new Error(cargoData?.message ?? 'Не вдалося завантажити вантажі');
      if (!tripResponse.ok) throw new Error(tripData?.message ?? 'Не вдалося завантажити поїздки');
      if (!currentResponse.ok) throw new Error((currentData as any)?.message ?? 'Не вдалося завантажити поточний маршрут');
      setCargo(cargoData); setTrips(tripData); setCurrentTrip(currentData);
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { setLoading(false); }
  },[]);

  useEffect(() => { void load(); },[load,liveVersion]);

  const activeTrip = currentTrip ?? trips.find((trip) => trip.status === 'published' || trip.status === 'active') ?? null;

  return <Screen><View style={s.header}><View><View style={s.brandRow}><BrandLogo compact/><View style={[s.live,!connected&&{opacity:.45}]}><PulseDot color={colors.success} size={5}/><Text style={s.liveText}>{connected?'LIVE':'SYNC'}</Text></View></View><Text style={s.kicker}>SMART ROUTES · VERIFIED DEALS · SECURE PAYMENT</Text></View><Pressable onPress={()=>router.push('/(tabs)/profile')} hitSlop={12} style={({pressed})=>[s.avatar,pressed&&s.pressed]}><Text style={s.avatarText}>{user?.displayName.slice(0,2).toUpperCase()}</Text></Pressable></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:124}}>
      <View style={s.trust}><Text style={s.eye}>IDENTITY</Text><Text style={s.meta}>{user?.verificationStatus==='verified'?'VERIFIED':'VERIFICATION REQUIRED'}</Text></View>

      <FadeInView delay={35}><View style={s.map}><View style={s.mapTop}><Text style={s.mapLabel}>ROUTE ENGINE · SCHEMATIC</Text><Text style={s.build}>LIVE</Text></View><RoutePreview origin={activeTrip?.origin.publicLabel??'СТАРТ'} destination={activeTrip?.destination.publicLabel??'ФІНІШ'} distance={activeTrip?distanceLabel(activeTrip.route.distanceM):undefined}/><Text style={s.routeTitle}>{activeTrip ? `${activeTrip.origin.publicLabel} → ${activeTrip.destination.publicLabel}` : 'Створіть напрямок'}</Text><Text style={s.meta}>{activeTrip ? `${distanceLabel(activeTrip.route.distanceM)} · ${activeTrip.route.quality.toUpperCase()}` : 'PostGIS corridor matching готовий до першої поїздки'}</Text>{activeTrip&&<Pressable onPress={()=>router.push({pathname:'/trip/[id]',params:{id:activeTrip.id}})} style={s.currentMatch}><View><Text style={s.eye}>ПОТОЧНИЙ MATCH</Text><Text style={s.currentMatchText}>{activeTrip.status==='published'?'Відкрити актуальні вантажі':'Маршрут збережено · зараз неактивний'}</Text></View><Text style={s.action}>→</Text></Pressable>}</View></FadeInView>

      <FadeInView delay={75}><WaitingPulse/></FadeInView>

      <View style={s.section}><View style={s.row}><View><Text style={s.eye}>МОЇ ПОЇЗДКИ</Text><Text style={s.sectionTitle}>{trips.length ? `${trips.length} маршрутів` : 'Ще немає маршрутів'}</Text></View><Pressable hitSlop={10} onPress={load}><Text style={s.action}>{loading?'...':'ОНОВИТИ'}</Text></Pressable></View>
        {trips.slice(0,3).map((trip) => <Pressable key={trip.id} onPress={()=>router.push({pathname:'/trip/[id]',params:{id:trip.id}})} style={({pressed})=>[s.item,pressed&&s.pressed]}><View style={s.row}><Text style={s.itemTitle}>{trip.origin.publicLabel} → {trip.destination.publicLabel}</Text><Text style={s.arrow}>→</Text></View><View style={[s.row,{marginTop:7}]}><Text style={s.status}>{trip.status.toUpperCase()}</Text><Text style={s.meta}>{trip.vehicle.label ?? 'Авто'} · {trip.maxDetourKm} км corridor</Text></View></Pressable>)}
      </View>

      <View style={s.section}><View style={s.row}><View><Text style={s.eye}>МОЇ ВАНТАЖІ</Text><Text style={s.sectionTitle}>{cargo.length?`${cargo.length} активностей`:'Ще немає вантажів'}</Text></View></View>
        {!!error&&<Text style={s.error}>{error}</Text>}
        {cargo.slice(0,3).map((x)=><Pressable key={x.id} onPress={()=>router.push({pathname:'/cargo/[id]',params:{id:x.id}})} style={({pressed})=>[s.item,pressed&&s.pressed]}><View style={s.row}><Text style={s.itemTitle}>{x.title}</Text><Text style={s.price}>{Math.round(x.rewardMinor/100)} ₴</Text></View><Text style={s.meta}>{x.pickup.publicLabel} → {x.delivery.publicLabel}</Text><View style={[s.row,{marginTop:8}]}><Text style={s.status}>{x.status.toUpperCase()}</Text><Text style={s.meta}>{x.weightKg?`${x.weightKg} кг`:'вага не вказана'}</Text></View></Pressable>)}
      </View>

      <View style={s.panel}><Text style={s.eye}>ВАШ НАПРЯМОК</Text><Text style={s.panelTitle}>Куди ви їдете?</Text><Pressable onPress={()=>router.push('/create-trip')} style={({pressed})=>[s.primary,pressed&&s.pressed]}><Text style={s.primaryText}>Я ЇДУ</Text><Text style={s.primaryText}>→</Text></Pressable><Pressable onPress={()=>router.push('/create-cargo')} style={({pressed})=>[s.secondary,pressed&&s.pressed]}><View><Text style={s.meta}>ПОТРІБНО ПЕРЕВЕЗТИ РІЧ</Text><Text style={s.action}>СТВОРИТИ ВАНТАЖ</Text></View><Text style={s.action}>→</Text></Pressable></View>
    </ScrollView>
  </Screen>;
}

const s=themedStyleSheet(()=>({header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:12,paddingBottom:14},brandRow:{flexDirection:'row',alignItems:'center',gap:8},brand:{color:colors.text,fontSize:30,fontWeight:'900',letterSpacing:-1},live:{paddingHorizontal:8,paddingVertical:5,borderRadius:radii.pill,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',gap:5},liveDot:{width:5,height:5,borderRadius:3,backgroundColor:colors.success},liveText:{color:colors.success,fontSize:7,fontWeight:'900',letterSpacing:1},kicker:{color:colors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.25,marginTop:3},avatar:{width:44,height:44,borderRadius:14,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},avatarText:{color:colors.text,fontWeight:'900'},pressed:{opacity:.62},trust:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:radii.md,paddingHorizontal:13,paddingVertical:10,flexDirection:'row',justifyContent:'space-between'},eye:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.4},meta:{color:colors.textSecondary,fontSize:10},map:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.borderStrong,borderRadius:radii.xl,padding:12,paddingTop:42,marginTop:12,elevation:3,shadowColor:colors.shadow,shadowOpacity:.12,shadowRadius:16,shadowOffset:{width:0,height:7}},mapTop:{position:'absolute',top:14,left:14,right:14,flexDirection:'row',justifyContent:'space-between'},mapLabel:{color:colors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.4},build:{color:colors.accent,fontSize:8,fontWeight:'900'},route:{height:70,flexDirection:'row',alignItems:'center'},dot:{width:14,height:14,borderRadius:7,borderWidth:3,borderColor:colors.accent},end:{width:14,height:14,borderRadius:7,backgroundColor:colors.accent},line:{height:3,flex:1,backgroundColor:colors.accent,borderRadius:2},shortLine:{height:3,width:42,backgroundColor:colors.accent,borderRadius:2},detour:{width:24,height:24,borderRightWidth:2,borderTopWidth:2,borderColor:colors.accent,transform:[{rotate:'-15deg'}],marginRight:-8},reward:{borderWidth:1,borderColor:colors.accent,borderRadius:10,paddingHorizontal:9,paddingVertical:7,backgroundColor:colors.accentSoft,marginRight:7},rewardText:{color:colors.accentStrong,fontSize:14,fontWeight:'900'},routeTitle:{color:colors.text,fontSize:20,fontWeight:'900',marginTop:12,letterSpacing:-.4},section:{marginTop:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:14},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},sectionTitle:{color:colors.text,fontSize:17,fontWeight:'900',marginTop:3},action:{color:colors.accent,fontSize:10,fontWeight:'900'},error:{color:colors.danger,fontSize:11,marginVertical:8},item:{borderTopWidth:1,borderTopColor:colors.border,paddingVertical:13},itemTitle:{color:colors.text,fontSize:13,fontWeight:'900',flex:1},price:{color:colors.accent,fontSize:14,fontWeight:'900'},arrow:{color:colors.accent,fontSize:16,fontWeight:'900'},status:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:1},panel:{marginTop:12,padding:17,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg},panelTitle:{color:colors.text,fontSize:21,fontWeight:'900',marginTop:5,marginBottom:14},primary:{minHeight:54,backgroundColor:colors.accent,borderRadius:radii.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},primaryText:{color:colors.accentText,fontSize:12,fontWeight:'900',letterSpacing:.8},currentMatch:{marginTop:13,paddingTop:12,borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},currentMatchText:{color:colors.text,fontSize:11,fontWeight:'800',marginTop:3},secondary:{marginTop:9,minHeight:58,borderWidth:1,borderColor:colors.border,borderRadius:radii.md,backgroundColor:colors.surface,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}));
