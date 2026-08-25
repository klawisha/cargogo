import { useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { colors, radii, themedStyleSheet } from '@/theme/tokens';

type P={x:number;y:number};
const POINTS:P[]=[{x:.07,y:.77},{x:.19,y:.67},{x:.28,y:.72},{x:.40,y:.54},{x:.53,y:.58},{x:.63,y:.39},{x:.74,y:.43},{x:.91,y:.19}];
function Segment({a,b,w,h}:{a:P;b:P;w:number;h:number}){const x1=a.x*w,y1=a.y*h,x2=b.x*w,y2=b.y*h;const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy),ang=Math.atan2(dy,dx)*180/Math.PI;return <View style={[s.segment,{left:(x1+x2)/2-len/2,top:(y1+y2)/2-2,width:len,transform:[{rotate:`${ang}deg`}]}]}/>}
export function RoutePreview({origin,destination,distance,compact=false}:{origin:string;destination:string;distance?:string;compact?:boolean}){
 const[size,setSize]=useState({w:0,h:0});const points=useMemo(()=>POINTS,[]);const onLayout=(e:LayoutChangeEvent)=>setSize({w:e.nativeEvent.layout.width,h:e.nativeEvent.layout.height});
 return <View style={[s.card,compact&&s.compact]} onLayout={onLayout}>
   <View style={s.gridA}/><View style={s.gridB}/><View style={s.roadGhostA}/><View style={s.roadGhostB}/>
   {!!size.w&&points.slice(0,-1).map((p,i)=><Segment key={i} a={p} b={points[i+1]} w={size.w} h={size.h}/>)}
   {!!size.w&&points.map((p,i)=><View key={`n${i}`} style={[s.node,{left:p.x*size.w-3,top:p.y*size.h-3},i===0&&s.startNode,i===points.length-1&&s.endNode]}/>) }
   <View style={s.origin}><Text numberOfLines={1} style={s.place}>{origin}</Text></View>
   <View style={s.destination}><Text numberOfLines={1} style={s.place}>{destination}</Text></View>
   {!!distance&&<View style={s.distance}><Text style={s.distanceText}>{distance}</Text><Text style={s.distanceSub}>SCHEMATIC ROUTE</Text></View>}
 </View>
}
const s=themedStyleSheet(()=>({
 card:{height:174,borderRadius:radii.lg,overflow:'hidden',backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border,position:'relative'},compact:{height:130},
 gridA:{position:'absolute',left:-20,right:-20,top:48,height:1,backgroundColor:colors.border,opacity:.42,transform:[{rotate:'8deg'}]},gridB:{position:'absolute',left:-20,right:-20,top:108,height:1,backgroundColor:colors.border,opacity:.35,transform:[{rotate:'-12deg'}]},
 roadGhostA:{position:'absolute',width:'74%',height:2,left:'8%',top:'47%',backgroundColor:colors.borderStrong,opacity:.25,transform:[{rotate:'-23deg'}]},roadGhostB:{position:'absolute',width:'58%',height:2,right:'-3%',top:'62%',backgroundColor:colors.borderStrong,opacity:.18,transform:[{rotate:'18deg'}]},
 segment:{position:'absolute',height:4,borderRadius:3,backgroundColor:colors.accent,shadowColor:colors.accent,shadowOpacity:.4,shadowRadius:5,elevation:2},
 node:{position:'absolute',width:6,height:6,borderRadius:3,backgroundColor:colors.accentStrong,borderWidth:1,borderColor:colors.surfaceMuted},startNode:{width:13,height:13,borderRadius:7,marginLeft:-3.5,marginTop:-3.5,borderWidth:3,borderColor:colors.accent,backgroundColor:colors.surfaceMuted},endNode:{width:14,height:14,borderRadius:7,marginLeft:-4,marginTop:-4,backgroundColor:colors.accent,borderColor:colors.accentStrong},
 origin:{position:'absolute',left:10,bottom:10,maxWidth:'46%',paddingHorizontal:9,paddingVertical:6,borderRadius:radii.pill,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.borderStrong},destination:{position:'absolute',right:10,top:10,maxWidth:'46%',paddingHorizontal:9,paddingVertical:6,borderRadius:radii.pill,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.accent},place:{color:colors.text,fontSize:9,fontWeight:'900'},
 distance:{position:'absolute',left:12,top:12},distanceText:{color:colors.text,fontSize:15,fontWeight:'900'},distanceSub:{color:colors.muted,fontSize:7,fontWeight:'900',letterSpacing:1,marginTop:2}
}));
