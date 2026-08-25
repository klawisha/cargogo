import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiFetch, readJsonSafe } from '@/api/client';
import { colors, radii, themedStyleSheet } from '@/theme/tokens';
import { Screen } from '@/ui/screen';
import { BrandIcon } from '@/ui/brand-icons';
import { useLiveVersion } from '@/live/live-context';

type Case={
  userId:string;
  businessName:string|null;
  businessRegistrationRef:string|null;
  professionalStatus:string;
  submittedAt:string;
  displayName:string;
  phone:string|null;
  identityStatus:string|null;
  licenseStatus:string|null;
  vehicleCount:number;
  verifiedVehicleCount:number;
};

const statusLabel=(x:string|null)=>x==='verified'?'VERIFIED':x==='pending'||x==='submitted'?'PENDING':x==='rejected'?'REJECTED':'NOT VERIFIED';
const statusTone=(x:string|null)=>x==='verified'?colors.accent:x==='rejected'?colors.danger:colors.muted;

export default function ProfessionalReview(){
  const live=useLiveVersion('staff');
  const [queue,setQueue]=useState<Case[]>([]);
  const [selected,setSelected]=useState<Case|null>(null);
  const [note,setNote]=useState('Перевірено вручну за наданими реквізитами');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    try{
      const r=await apiFetch('/staff/professional-carriers');
      const d=await readJsonSafe<Case[]>(r);
      if(!r.ok||!d)throw new Error((d as any)?.message??'Не вдалося завантажити чергу ФОП');
      setQueue(d); setError('');
      if(selected&&!d.some(x=>x.userId===selected.userId))setSelected(null);
    }catch(e:any){setError(e?.message??'Помилка завантаження')}
  },[selected]);
  useFocusEffect(useCallback(()=>{void load()},[load,live]));

  const readiness=useMemo(()=>selected?[
    {label:'ОСОБА',value:statusLabel(selected.identityStatus),ok:selected.identityStatus==='verified'},
    {label:'ПРАВА',value:statusLabel(selected.licenseStatus),ok:selected.licenseStatus==='verified'},
    {label:'АВТО',value:`${selected.verifiedVehicleCount}/${selected.vehicleCount} VERIFIED`,ok:selected.verifiedVehicleCount>0},
  ]:[],[selected]);

  async function decide(decision:'verified'|'rejected'){
    if(!selected||note.trim().length<3)return;
    setBusy(true); setError('');
    try{
      const r=await apiFetch(`/staff/professional-carriers/${selected.userId}`,{method:'PATCH',body:JSON.stringify({decision,note:note.trim()})});
      const d=await readJsonSafe<any>(r);
      if(!r.ok)throw new Error(d?.message??'Не вдалося зберегти рішення');
      setSelected(null); setNote('Перевірено вручну за наданими реквізитами'); await load();
    }catch(e:any){setError(e?.message??'Помилка рішення')}finally{setBusy(false)}
  }

  return <Screen><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:100}}>
    <View style={s.header}><Pressable onPress={()=>selected?setSelected(null):router.back()} hitSlop={12}><Text style={s.back}>←</Text></Pressable><View style={{flex:1}}><Text style={s.eye}>TRUST · BUSINESS REVIEW</Text><Text style={s.title}>{selected?'Профіль перевізника':'Перевірка ФОП'}</Text><Text style={s.subtitle}>{selected?'Ручна перевірка професійного профілю':'Черга заявок на professional carrier mode'}</Text></View><View style={s.staffBadge}><Text style={s.staffBadgeText}>STAFF</Text></View></View>
    {!!error&&<View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
    {!selected?<>
      <View style={s.summary}><View><Text style={s.summaryEye}>PENDING BUSINESS PROFILES</Text><Text style={s.summaryTitle}>{queue.length}</Text></View><Text style={s.summaryBody}>Підтвердження ФОП відкриває професійні маршрути без casual-лімітів. Рішення має бути обґрунтованим і фіксується у профілі.</Text></View>
      <Text style={s.section}>ЧЕРГА</Text>
      {queue.map(x=><Pressable key={x.userId} onPress={()=>setSelected(x)} style={({pressed})=>[s.caseCard,pressed&&{opacity:.72}]}>
        <View style={s.caseTop}><View style={{flex:1}}><Text style={s.business}>{x.businessName||'Без назви'}</Text><Text style={s.person}>{x.displayName} · {x.phone||'телефон відсутній'}</Text></View><View style={s.pending}><Text style={s.pendingText}>PENDING</Text></View></View>
        <View style={s.regRow}><Text style={s.regLabel}>РНОКПП / ЄДРПОУ</Text><Text style={s.regValue}>{x.businessRegistrationRef||'—'}</Text></View>
        <View style={s.miniStatuses}><MiniStatus label="ОСОБА" value={statusLabel(x.identityStatus)} ok={x.identityStatus==='verified'}/><MiniStatus label="ПРАВА" value={statusLabel(x.licenseStatus)} ok={x.licenseStatus==='verified'}/><MiniStatus label="АВТО" value={`${x.verifiedVehicleCount}/${x.vehicleCount}`} ok={x.verifiedVehicleCount>0}/></View>
        <View style={s.cardFoot}><Text style={s.date}>{new Date(x.submittedAt).toLocaleString()}</Text><Text style={s.open}>ВІДКРИТИ →</Text></View>
      </Pressable>)}
      {!queue.length&&<View style={s.empty}><BrandIcon name="deals" color={colors.muted} size={28}/><Text style={s.emptyTitle}>Черга порожня</Text><Text style={s.emptyText}>Нові заявки ФОП з'являться тут після переходу користувача в professional mode.</Text></View>}
    </>:<>
      <View style={s.hero}><View style={s.heroIcon}><BrandIcon name="deals" color={colors.accent} size={25}/></View><View style={{flex:1}}><Text style={s.heroEye}>PROFESSIONAL CARRIER</Text><Text style={s.heroTitle}>{selected.businessName||'Без назви'}</Text><Text style={s.heroMeta}>{selected.displayName} · {selected.phone||'—'}</Text></View><View style={s.pending}><Text style={s.pendingText}>UNDER REVIEW</Text></View></View>
      <Text style={s.section}>РЕКВІЗИТИ</Text>
      <View style={s.panel}><Info label="НАЗВА / ПІБ ФОП" value={selected.businessName||'—'}/><Info label="РНОКПП / ЄДРПОУ" value={selected.businessRegistrationRef||'—'}/><Info label="ЗАЯВКА ОНОВЛЕНА" value={new Date(selected.submittedAt).toLocaleString()}/></View>
      <Text style={s.section}>КОНТЕКСТ TRUST</Text>
      <View style={s.readiness}>{readiness.map(x=><View key={x.label} style={s.readyCell}><Text style={s.readyLabel}>{x.label}</Text><Text style={[s.readyValue,{color:x.ok?colors.accent:colors.muted}]}>{x.value}</Text><View style={[s.readyDot,{backgroundColor:x.ok?colors.accent:colors.border}]}/></View>)}</View>
      <View style={s.notice}><Text style={s.noticeTitle}>ЩО ПЕРЕВІРЯЄ REVIEWER</Text><Text style={s.noticeText}>Зіставте назву/ПІБ та реєстраційний ідентифікатор з доступним офіційним або надійним реєстровим джерелом. Identity, права та автомобіль показані як контекст, але не замінюють перевірку підприємницького статусу.</Text></View>
      <Text style={s.section}>КОМЕНТАР РІШЕННЯ</Text>
      <TextInput value={note} onChangeText={setNote} multiline textAlignVertical="top" placeholder="Що саме перевірено та на якій підставі прийнято рішення" placeholderTextColor={colors.muted} style={s.input}/>
      <Pressable disabled={busy||note.trim().length<3} onPress={()=>void decide('verified')} style={({pressed})=>[s.approve,(busy||note.trim().length<3)&&s.disabled,pressed&&{opacity:.8}]}><Text style={s.approveText}>{busy?'ЗБЕРЕЖЕННЯ…':'ПІДТВЕРДИТИ ФОП'}</Text><Text style={s.approveText}>✓</Text></Pressable>
      <Pressable disabled={busy||note.trim().length<3} onPress={()=>void decide('rejected')} style={({pressed})=>[s.reject,(busy||note.trim().length<3)&&s.disabled,pressed&&{opacity:.8}]}><Text style={s.rejectText}>ВІДХИЛИТИ ЗАЯВКУ</Text><Text style={s.rejectText}>×</Text></Pressable>
    </>}
  </ScrollView></Screen>;
}

function MiniStatus({label,value,ok}:{label:string;value:string;ok:boolean}){return <View style={s.mini}><Text style={s.miniLabel}>{label}</Text><Text style={[s.miniValue,{color:ok?colors.accent:colors.muted}]} numberOfLines={1}>{value}</Text></View>}
function Info({label,value}:{label:string;value:string}){return <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue} selectable>{value}</Text></View>}

const s=themedStyleSheet(()=>({
  header:{minHeight:100,flexDirection:'row',alignItems:'center',gap:14},back:{color:colors.text,fontSize:25,fontWeight:'900'},eye:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.4},title:{color:colors.text,fontSize:26,fontWeight:'900',marginTop:3},subtitle:{color:colors.muted,fontSize:9,fontWeight:'700',marginTop:4},staffBadge:{borderWidth:1,borderColor:colors.accent,borderRadius:radii.pill,paddingHorizontal:9,paddingVertical:6,backgroundColor:colors.accentSoft},staffBadgeText:{color:colors.accent,fontSize:8,fontWeight:'900'},errorBox:{borderWidth:1,borderColor:colors.danger,borderRadius:radii.md,padding:11,marginBottom:10},errorText:{color:colors.danger,fontSize:10,fontWeight:'800'},summary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:17,flexDirection:'row',gap:16,alignItems:'center'},summaryEye:{color:colors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.1},summaryTitle:{color:colors.accent,fontSize:34,fontWeight:'900',marginTop:2},summaryBody:{color:colors.textSecondary,fontSize:10,lineHeight:16,flex:1},section:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.3,marginTop:20,marginBottom:8},caseCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:15,marginBottom:9},caseTop:{flexDirection:'row',gap:10,alignItems:'flex-start'},business:{color:colors.text,fontSize:16,fontWeight:'900'},person:{color:colors.muted,fontSize:9,marginTop:5},pending:{borderRadius:radii.pill,paddingHorizontal:8,paddingVertical:5,backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.accent},pendingText:{color:colors.accent,fontSize:7,fontWeight:'900',letterSpacing:.7},regRow:{flexDirection:'row',justifyContent:'space-between',gap:12,borderTopWidth:1,borderColor:colors.border,marginTop:12,paddingTop:11},regLabel:{color:colors.muted,fontSize:8,fontWeight:'800'},regValue:{color:colors.text,fontSize:10,fontWeight:'900'},miniStatuses:{flexDirection:'row',gap:6,marginTop:10},mini:{flex:1,backgroundColor:colors.surfaceMuted,borderRadius:radii.sm,padding:8},miniLabel:{color:colors.muted,fontSize:7,fontWeight:'900'},miniValue:{fontSize:8,fontWeight:'900',marginTop:4},cardFoot:{marginTop:11,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},date:{color:colors.muted,fontSize:8},open:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:.7},empty:{alignItems:'center',paddingVertical:42,paddingHorizontal:24},emptyTitle:{color:colors.text,fontSize:16,fontWeight:'900',marginTop:10},emptyText:{color:colors.muted,fontSize:10,lineHeight:16,textAlign:'center',marginTop:6},hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.accent,borderRadius:radii.lg,padding:16,flexDirection:'row',alignItems:'center',gap:12},heroIcon:{width:48,height:48,borderRadius:15,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},heroEye:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:1.2},heroTitle:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:3},heroMeta:{color:colors.muted,fontSize:9,marginTop:4},panel:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,paddingHorizontal:14},info:{paddingVertical:12,borderBottomWidth:1,borderColor:colors.border},infoLabel:{color:colors.muted,fontSize:8,fontWeight:'900',letterSpacing:.8},infoValue:{color:colors.text,fontSize:12,fontWeight:'900',marginTop:5},readiness:{flexDirection:'row',gap:7},readyCell:{flex:1,minHeight:82,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.md,padding:10},readyLabel:{color:colors.muted,fontSize:7,fontWeight:'900'},readyValue:{fontSize:9,fontWeight:'900',marginTop:8},readyDot:{width:6,height:6,borderRadius:3,marginTop:10},notice:{marginTop:12,backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border,borderRadius:radii.md,padding:13},noticeTitle:{color:colors.text,fontSize:9,fontWeight:'900',letterSpacing:.7},noticeText:{color:colors.textSecondary,fontSize:10,lineHeight:16,marginTop:6},input:{minHeight:104,borderWidth:1,borderColor:colors.border,borderRadius:radii.md,padding:12,color:colors.text,backgroundColor:colors.surface,fontSize:11},approve:{minHeight:54,borderRadius:radii.md,backgroundColor:colors.accent,paddingHorizontal:15,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},approveText:{color:colors.accentText,fontSize:9,fontWeight:'900',letterSpacing:.8},reject:{minHeight:52,borderRadius:radii.md,borderWidth:1,borderColor:colors.danger,paddingHorizontal:15,marginTop:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},rejectText:{color:colors.danger,fontSize:9,fontWeight:'900',letterSpacing:.8},disabled:{opacity:.45}
}));
