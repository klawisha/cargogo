import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from '@/api/client';
import {colors,themedStyleSheet} from '@/theme/tokens';
import { Screen } from '@/ui/screen';

type EconomicsQuote = {
  amountMinor:number;
  marketplaceFeeMinor:number;
  carrierAmountMinor:number;
  targetNetMarginMinor:number;
  estimatedAcquiringFeeMinor:number;
  estimatedPayoutFeeMinor:number;
};

export default function NewOffer(){
  const {cargoId,tripId,rewardMinor,title}=useLocalSearchParams<{cargoId:string;tripId:string;rewardMinor:string;title:string}>();
  const suggested=Math.max(1,Math.round(Number(rewardMinor||0)/100));
  const [price,setPrice]=useState(String(suggested));
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [quote,setQuote]=useState<EconomicsQuote|null>(null);

  useEffect(()=>{
    const amount=Number(price.replace(',','.'));
    if(!Number.isFinite(amount)||amount<=0){setQuote(null);return;}
    const amountMinor=Math.round(amount*100);
    const timer=setTimeout(()=>{
      void (async()=>{
        try{
          const r=await apiFetch(`/economics/quote?amountMinor=${amountMinor}`);
          if(r.ok)setQuote(await r.json());
        }catch{}
      })();
    },250);
    return()=>clearTimeout(timer);
  },[price]);

  async function submit(){
    setBusy(true);setError('');
    try{
      const amount=Number(price.replace(',','.'));
      if(!Number.isFinite(amount)||amount<=0)throw new Error('Вкажіть коректну ціну');
      const r=await apiFetch('/offers',{method:'POST',body:JSON.stringify({cargoId,tripId,amountMinor:Math.round(amount*100),currency:'UAH',message:message.trim()||undefined})});
      const data=await r.json();if(!r.ok)throw new Error(data?.message??'Не вдалося надіслати пропозицію');
      router.back();
    }catch(e){setError(e instanceof Error?e.message:'Помилка');}finally{setBusy(false);}
  }
  return <Screen><View style={s.header}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>←</Text></Pressable><View><Text style={s.eye}>ПРОПОЗИЦІЯ</Text><Text style={s.title}>{title||'Вантаж'}</Text></View></View>
    <View style={s.panel}><Text style={s.label}>ВАША ЦІНА</Text><View style={s.priceRow}><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={s.priceInput}/><Text style={s.currency}>₴</Text></View><Text style={s.hint}>Ціну можна змінювати, поки власник вантажу не прийняв пропозицію.</Text>
    {quote&&<View style={s.quote}><Text style={s.quoteTitle}>РОЗРАХУНОК ДО ПРИЙНЯТТЯ</Text><View style={s.quoteRow}><Text style={s.quoteLabel}>Ціна для клієнта</Text><Text style={s.quoteValue}>{(quote.amountMinor/100).toFixed(2)} ₴</Text></View><View style={s.quoteRow}><Text style={s.quoteLabel}>Сервісний збір</Text><Text style={s.quoteValue}>{(quote.marketplaceFeeMinor/100).toFixed(2)} ₴</Text></View><View style={s.quoteRow}><Text style={s.quoteLabel}>Ви отримаєте</Text><Text style={s.quoteAccent}>{(quote.carrierAmountMinor/100).toFixed(2)} ₴</Text></View><Text style={s.quoteNote}>Сервісний збір включає прогноз платіжних витрат і цільову маржу CargoGo. Остаточна сума вашої виплати фіксується при прийнятті пропозиції.</Text></View>}
    <Text style={s.label}>КОМЕНТАР</Text><TextInput value={message} onChangeText={setMessage} maxLength={500} multiline placeholder="Наприклад: можу забрати ввечері" placeholderTextColor={colors.muted} style={[s.input,{minHeight:90,textAlignVertical:'top'}]}/>
    {!!error&&<Text style={s.error}>{error}</Text>}
    <Pressable disabled={busy} onPress={submit} style={({pressed})=>[s.primary,(pressed||busy)&&{opacity:.6}]}><Text style={s.primaryText}>{busy?'НАДСИЛАННЯ...':'НАДІСЛАТИ ПРОПОЗИЦІЮ'}</Text><Text style={s.primaryText}>→</Text></Pressable></View>
  </Screen>;
}
const s=themedStyleSheet(()=>({header:{minHeight:84,flexDirection:'row',alignItems:'center',gap:15,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:40,height:40,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:20,fontWeight:'900'},eye:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.3},title:{color:colors.text,fontSize:20,fontWeight:'900',marginTop:4},panel:{marginTop:14,padding:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},label:{color:colors.textSecondary,fontSize:10,fontWeight:'900',letterSpacing:1.2,marginBottom:8,marginTop:8},priceRow:{height:64,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background,flexDirection:'row',alignItems:'center'},priceInput:{flex:1,color:colors.text,fontSize:30,fontWeight:'900',paddingHorizontal:14},currency:{color:colors.accent,fontSize:25,fontWeight:'900',paddingRight:16},hint:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:8,marginBottom:10},quote:{borderWidth:1,borderColor:colors.border,padding:14,marginBottom:10},quoteTitle:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.2,marginBottom:5},quoteRow:{flexDirection:'row',justifyContent:'space-between',gap:10,marginTop:7},quoteLabel:{color:colors.textSecondary,fontSize:11},quoteValue:{color:colors.text,fontSize:12,fontWeight:'800'},quoteAccent:{color:colors.accent,fontSize:13,fontWeight:'900'},quoteNote:{color:colors.muted,fontSize:10,lineHeight:15,marginTop:10},input:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.background,color:colors.text,padding:14},error:{color:colors.danger,fontSize:12,marginTop:10},primary:{minHeight:54,backgroundColor:colors.accent,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,marginTop:16},primaryText:{color:colors.accentText,fontSize:12,fontWeight:'900',letterSpacing:.8}}));
