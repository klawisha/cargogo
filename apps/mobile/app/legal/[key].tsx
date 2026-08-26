import { router,useLocalSearchParams } from 'expo-router';
import { useEffect,useState } from 'react';
import { Pressable,ScrollView,Text,View } from 'react-native';
import { apiFetch,readJsonSafe } from '@/api/client';
import { Screen } from '@/ui/screen';
import { LegalDocument } from '@/ui/legal-document';
import { AppFooter } from '@/ui/app-footer';
import { colors,radii,themedStyleSheet } from '@/theme/tokens';
type D={key:string;title:string;version:string;content:string;requiredAtRegistration?:boolean};
export default function LegalDoc(){
 const{key}=useLocalSearchParams<{key:string}>();const[d,setD]=useState<D|null>(null);const[error,setError]=useState('');
 useEffect(()=>{if(!key)return;void apiFetch(`/legal/documents/${encodeURIComponent(key)}`).then(async r=>{const x=await readJsonSafe<D>(r);if(r.ok&&x){setD(x);setError('')}else setError('Не вдалося завантажити документ.')}).catch(()=>setError('Не вдалося завантажити документ.'))},[key]);
 return <Screen><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:35}}>
  <View style={s.head}><Pressable onPress={()=>router.back()} style={s.backButton}><Text style={s.back}>←</Text></Pressable><View style={{flex:1}}><Text style={s.eye}>LEGAL DOCUMENT · {d?.version??'…'}</Text><Text style={s.title}>{d?.title??'Документ'}</Text>{d?.requiredAtRegistration&&<View style={s.required}><Text style={s.requiredText}>REQUIRED AT REGISTRATION</Text></View>}</View></View>
  {error?<View style={s.errorBox}><Text style={s.error}>{error}</Text></View>:d?<LegalDocument content={d.content} title={d.title}/>:<Text style={s.loading}>Завантаження актуальної версії…</Text>}
  <AppFooter/>
 </ScrollView></Screen>
}
const s=themedStyleSheet(()=>({head:{minHeight:116,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:10},backButton:{width:42,height:42,borderWidth:1,borderColor:colors.border,borderRadius:radii.pill,alignItems:'center',justifyContent:'center'},back:{color:colors.text,fontSize:22,marginTop:-2},eye:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:1.25},title:{color:colors.text,fontSize:24,lineHeight:30,fontWeight:'900',marginTop:4},required:{alignSelf:'flex-start',backgroundColor:colors.accentSoft,borderRadius:radii.pill,paddingHorizontal:9,paddingVertical:5,marginTop:8},requiredText:{color:colors.accent,fontSize:7,fontWeight:'900',letterSpacing:.8},loading:{color:colors.textSecondary,fontSize:12,marginTop:20},errorBox:{backgroundColor:colors.dangerSoft,borderWidth:1,borderColor:colors.danger,borderRadius:radii.md,padding:14},error:{color:colors.danger,fontSize:11,fontWeight:'800'}}));
