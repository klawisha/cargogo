import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import { colors, radii, themedStyleSheet } from '@/theme/tokens';

type Props={origin:string;destination:string;distance?:string;durationS?:number|null;coordinates?:LatLng[];compact?:boolean};
export function RoutePreview({origin,destination,distance,durationS,coordinates=[],compact=false}:Props){
 const ref=useRef<MapView|null>(null);
 const route=useMemo(()=>coordinates.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)),[coordinates]);
 useEffect(()=>{if(route.length>1){const timer=setTimeout(()=>ref.current?.fitToCoordinates(route,{edgePadding:{top:48,right:36,bottom:48,left:36},animated:false}),120);return()=>clearTimeout(timer)}},[route]);
 const start=route[0],end=route[route.length-1];
 const routeKey=useMemo(()=>route.length>1?`${route.length}:${route[0].latitude.toFixed(5)},${route[0].longitude.toFixed(5)}:${route[route.length-1].latitude.toFixed(5)},${route[route.length-1].longitude.toFixed(5)}:${route[Math.floor(route.length/2)].latitude.toFixed(5)},${route[Math.floor(route.length/2)].longitude.toFixed(5)}`:'empty',[route]);
 const duration=durationS?`${Math.floor(durationS/3600)?`${Math.floor(durationS/3600)} год `:''}${Math.max(1,Math.round((durationS%3600)/60))} хв`:null;
 if(route.length<2)return <View style={[s.fallback,compact&&s.compact]}><Text style={s.fallbackEye}>ROUTE ENGINE</Text><Text style={s.fallbackTitle}>{origin} → {destination}</Text><Text style={s.fallbackSub}>Маршрут ще не має дорожньої геометрії. Вкажіть MAPBOX_ACCESS_TOKEN на API та оновіть поїздку.</Text></View>;
 return <View style={[s.card,compact&&s.compact]}>
   <MapView key={routeKey} ref={ref} style={s.map} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false} showsCompass={false} showsBuildings={false}>
    <Polyline key={`line:${routeKey}`} coordinates={route} strokeColor={String(colors.accent)} strokeWidth={5}/>
    <Marker coordinate={start} title={origin}><View style={s.startMarker}><View style={s.startDot}/></View></Marker>
    <Marker coordinate={end} title={destination}><View style={s.endMarker}/></Marker>
   </MapView>
   <View pointerEvents="none" style={s.topBadge}><Text style={s.badgeEye}>ROAD ROUTE</Text><Text style={s.badgeValue}>{distance??'—'}{duration?` · ${duration}`:''}</Text></View>
   <View pointerEvents="none" style={s.origin}><Text numberOfLines={1} style={s.place}>● {origin}</Text></View>
   <View pointerEvents="none" style={s.destination}><Text numberOfLines={1} style={s.place}>◆ {destination}</Text></View>
 </View>
}
const s=themedStyleSheet(()=>({
 card:{height:220,borderRadius:radii.lg,overflow:'hidden',backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border,position:'relative'},compact:{height:165},map:{...({position:'absolute',left:0,right:0,top:0,bottom:0} as const)},
 topBadge:{position:'absolute',left:10,top:10,paddingHorizontal:10,paddingVertical:7,borderRadius:radii.md,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.borderStrong},badgeEye:{color:colors.accent,fontSize:7,fontWeight:'900',letterSpacing:1.1},badgeValue:{color:colors.text,fontSize:12,fontWeight:'900',marginTop:2},
 origin:{position:'absolute',left:10,bottom:10,maxWidth:'45%',paddingHorizontal:9,paddingVertical:6,borderRadius:radii.pill,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.borderStrong},destination:{position:'absolute',right:10,bottom:10,maxWidth:'45%',paddingHorizontal:9,paddingVertical:6,borderRadius:radii.pill,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.accent},place:{color:colors.text,fontSize:8,fontWeight:'900'},
 startMarker:{width:22,height:22,borderRadius:11,borderWidth:3,borderColor:colors.accent,backgroundColor:colors.surfaceRaised,alignItems:'center',justifyContent:'center'},startDot:{width:6,height:6,borderRadius:3,backgroundColor:colors.accent},endMarker:{width:18,height:18,borderRadius:5,backgroundColor:colors.accent,borderWidth:3,borderColor:colors.surfaceRaised,transform:[{rotate:'45deg'}]},
 fallback:{height:220,borderRadius:radii.lg,padding:18,justifyContent:'center',backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border},fallbackEye:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:1.2},fallbackTitle:{color:colors.text,fontSize:15,fontWeight:'900',marginTop:7},fallbackSub:{color:colors.textSecondary,fontSize:10,lineHeight:15,marginTop:7}
}));
