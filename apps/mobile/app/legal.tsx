import { router } from 'expo-router';
import { useEffect,useState } from 'react';
import { Pressable,ScrollView,Text,View } from 'react-native';
import { apiFetch,readJsonSafe } from '@/api/client';
import { Screen } from '@/ui/screen';
import { AppFooter } from '@/ui/app-footer';
import { colors,radii,themedStyleSheet } from '@/theme/tokens';
type Doc={key:string;title:string;version:string;requiredAtRegistration:boolean;summary:string};
export default function LegalIndex(){
 const[docs,setDocs]=useState<Doc[]>([]);const[loading,setLoading]=useState(true);
 useEffect(()=>{void apiFetch('/legal/documents').then(async r=>{const x=await readJsonSafe<Doc[]>(r);if(r.ok&&x)setDocs(x)}).catch(()=>{}).finally(()=>setLoading(false))},[]);
 const version=docs[0]?.version;
 return <Screen><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:35}}>
  <View style={s.head}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>←</Text></Pressable><View style={{flex:1}}><Text style={s.eye}>LEGAL CENTER</Text><Text style={s.title}>Документи CargoGo</Text></View></View>
  <View style={s.hero}><View style={{flex:1}}><Text style={s.heroTitle}>{docs.length||'—'} АКТУАЛЬНИХ ДОКУМЕНТІВ</Text><Text style={s.heroText}>Правила сервісу, приватності, оплат, спорів і режимів перевізника у читабельному форматі. Кожна редакція має окрему версію.</Text></View>{version&&<View style={s.versionBadge}><Text style={s.versionText}>{version}</Text></View>}</View>
  <View style={s.legend}><View style={s.dot}/><Text style={s.legendText}>Обов’язкові документи фіксуються в audit trail під час реєстрації.</Text></View>
  {loading&&<Text style={s.loading}>Завантаження legal package…</Text>}
  {docs.map((d,i)=><Pressable key={d.key} onPress={()=>router.push({pathname:'/legal/[key]' as any,params:{key:d.key}})} style={s.card}>
   <View style={s.index}><Text style={s.indexText}>{String(i+1).padStart(2,'0')}</Text></View><View style={{flex:1}}><View style={s.cardTop}><Text style={s.cardTitle}>{d.title}</Text>{d.requiredAtRegistration&&<View style={s.required}><Text style={s.requiredText}>REQUIRED</Text></View>}</View><Text style={s.meta}>VERSION {d.version}</Text><Text style={s.summary}>{d.summary}</Text></View><Text style={s.arrow}>›</Text>
  </Pressable>)}
  <AppFooter/>
 </ScrollView></Screen>
}
const s=themedStyleSheet(()=>({head:{minHeight:108,flexDirection:'row',alignItems:'center',gap:13},back:{width:42,height:42,borderWidth:1,borderColor:colors.border,borderRadius:radii.pill,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:22},eye:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.5},title:{color:colors.text,fontSize:27,fontWeight:'900',marginTop:4},hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.borderStrong,borderRadius:radii.lg,padding:16,flexDirection:'row',alignItems:'flex-start',gap:12},heroTitle:{color:colors.text,fontSize:13,fontWeight:'900'},heroText:{color:colors.textSecondary,fontSize:10.5,lineHeight:17,marginTop:7},versionBadge:{backgroundColor:colors.accentSoft,borderRadius:radii.pill,paddingHorizontal:10,paddingVertical:6},versionText:{color:colors.accent,fontSize:8,fontWeight:'900'},legend:{flexDirection:'row',alignItems:'center',gap:8,marginVertical:14,paddingHorizontal:3},dot:{width:6,height:6,borderRadius:3,backgroundColor:colors.success},legendText:{color:colors.muted,fontSize:9.5,flex:1},loading:{color:colors.muted,fontSize:10,marginVertical:12},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:14,marginBottom:9,flexDirection:'row',alignItems:'center',gap:11},index:{width:32,height:32,borderRadius:16,backgroundColor:colors.surfaceRaised,alignItems:'center',justifyContent:'center'},indexText:{color:colors.accent,fontSize:8,fontWeight:'900'},cardTop:{flexDirection:'row',alignItems:'center',gap:7,flexWrap:'wrap'},cardTitle:{color:colors.text,fontSize:14,fontWeight:'900',flexShrink:1},required:{backgroundColor:colors.accentSoft,borderRadius:radii.pill,paddingHorizontal:7,paddingVertical:3},requiredText:{color:colors.accent,fontSize:6.5,fontWeight:'900',letterSpacing:.6},meta:{color:colors.muted,fontSize:7.5,fontWeight:'800',marginTop:5,letterSpacing:.4},summary:{color:colors.textSecondary,fontSize:10,lineHeight:16,marginTop:7},arrow:{color:colors.accent,fontSize:22,fontWeight:'700'}}));
