import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authRequest, API_URL } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { colors, radii, themedStyleSheet } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import { BrandLogo } from '@/ui/brand-logo';

export default function AuthScreen(){
  const{user,setAuthenticatedUser}=useAuth();const{mode,setMode}=useAppTheme();
  const[formMode,setFormMode]=useState<'login'|'register'>('register');const[identifier,setIdentifier]=useState('');const[password,setPassword]=useState('');const[name,setName]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  if(user)return <Redirect href="/(tabs)"/>;
  const submit=async()=>{
    const cleanIdentifier=identifier.trim();const cleanName=name.trim();
    if(formMode==='register'){
      if(cleanName.length<2){setError('Ім’я має містити щонайменше 2 символи');return}
      if(!/^(?:\+?380|0)\d{9}$/.test(cleanIdentifier.replace(/[\s()\-]/g,''))){setError('Вкажіть коректний номер телефону');return}
      if(password.length<10){setError('Пароль має містити щонайменше 10 символів');return}
      if(!/[A-Za-z]/.test(password)||! /\d/.test(password)){setError('Пароль має містити літери та хоча б одну цифру');return}
    }
    setBusy(true);setError('');
    try{const body=formMode==='register'?{phone:cleanIdentifier,password,displayName:cleanName}:{identifier:cleanIdentifier,password};const data=await authRequest(formMode==='register'?'/auth/register':'/auth/login',body);setAuthenticatedUser(data.user);router.replace(data.user.staffRole?'/staff':'/(tabs)')}catch(e){setError(e instanceof Error?e.message:'Request failed')}finally{setBusy(false)}
  };
  return <SafeAreaView style={s.page}><View style={s.orb}/><View style={s.header}><View style={s.authBrand}><BrandLogo compact/></View><View style={s.theme}><Pressable onPress={()=>void setMode('dark')} style={[s.themeItem,mode==='dark'&&s.themeActive]}><Text style={[s.themeText,mode==='dark'&&s.themeTextActive]}>D</Text></Pressable><Pressable onPress={()=>void setMode('light')} style={[s.themeItem,mode==='light'&&s.themeActive]}><Text style={[s.themeText,mode==='light'&&s.themeTextActive]}>L</Text></Pressable><Pressable onPress={()=>void setMode('badger')} style={[s.themeItem,mode==='badger'&&s.themeActive]}><Text style={[s.themeText,mode==='badger'&&s.themeTextActive]}>B</Text></Pressable></View></View>
    <View style={s.hero}><Text style={s.heroKicker}>{formMode==='register'?'НОВИЙ ПРОФІЛЬ':'З ПОВЕРНЕННЯМ'}</Text><Text style={s.heroTitle}>{formMode==='register'?'Вантажі знаходять маршрут.':'Продовжуйте свої угоди.'}</Text><Text style={s.heroText}>CargoGo поєднує відправників із водіями, які вже їдуть потрібним напрямком.</Text></View>
    <View style={s.card}>{formMode==='register'&&<Field value={name} onChangeText={setName} placeholder="Ім’я"/>}<Field value={identifier} onChangeText={setIdentifier} placeholder={formMode==='register'?'Телефон · +380...':'Телефон або email'} keyboardType={formMode==='register'?'phone-pad':'default'} autoCapitalize="none"/><Field value={password} onChangeText={setPassword} placeholder="Пароль · 10+ символів" secureTextEntry/>{!!error&&<Text style={s.error}>{error}</Text>}<Pressable disabled={busy} onPress={submit} style={({pressed})=>[s.primary,(pressed||busy)&&{opacity:.7}]}><Text style={s.primaryText}>{busy?'ЗАЧЕКАЙТЕ':formMode==='register'?'СТВОРИТИ АКАУНТ':'УВІЙТИ'}</Text><Text style={s.primaryText}>→</Text></Pressable><Pressable onPress={()=>{setFormMode(formMode==='register'?'login':'register');setError('')}} style={s.switch}><Text style={s.switchText}>{formMode==='register'?'Вже маєте акаунт?  Увійти':'Новий користувач?  Зареєструватися'}</Text></Pressable></View>
    <Text style={s.api}>UI BUILD 1.4.2 · {API_URL}</Text>
  </SafeAreaView>;
}
function Field(props:any){return <TextInput {...props} placeholderTextColor={colors.muted} style={s.input}/>}
const s=themedStyleSheet(()=>({page:{flex:1,backgroundColor:colors.background,paddingHorizontal:18},orb:{position:'absolute',width:270,height:270,borderRadius:135,backgroundColor:colors.accentSoft,opacity:.48,right:-120,top:-85},header:{height:88,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},authBrand:{flexDirection:'row',alignItems:'center',gap:9},logo:{color:colors.text,fontSize:28,fontWeight:'900',letterSpacing:-1},tag:{color:colors.muted,fontSize:8,fontWeight:'900',letterSpacing:1.3,marginTop:2},theme:{flexDirection:'row',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.pill,padding:3},themeItem:{width:32,height:28,borderRadius:radii.pill,alignItems:'center',justifyContent:'center'},themeActive:{backgroundColor:colors.accent},themeText:{color:colors.muted,fontSize:11},themeTextActive:{color:colors.accentText},hero:{paddingTop:46,paddingBottom:24},heroKicker:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.5},heroTitle:{color:colors.text,fontSize:34,fontWeight:'900',lineHeight:39,letterSpacing:-1.2,marginTop:7,maxWidth:340},heroText:{color:colors.textSecondary,fontSize:13,lineHeight:20,marginTop:12,maxWidth:330},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.xl,padding:16,elevation:4,shadowColor:colors.shadow,shadowOpacity:.12,shadowRadius:18,shadowOffset:{width:0,height:7}},input:{height:54,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceRaised,color:colors.text,paddingHorizontal:14,marginBottom:10,borderRadius:radii.md,fontSize:13},primary:{minHeight:56,backgroundColor:colors.accent,borderRadius:radii.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,marginTop:2},primaryText:{color:colors.accentText,fontSize:11,fontWeight:'900',letterSpacing:.8},switch:{paddingVertical:17,alignItems:'center'},switchText:{color:colors.textSecondary,fontSize:11,fontWeight:'700'},error:{color:colors.danger,fontSize:11,marginBottom:10},api:{color:colors.muted,fontSize:8,marginTop:14,textAlign:'center'}}));
