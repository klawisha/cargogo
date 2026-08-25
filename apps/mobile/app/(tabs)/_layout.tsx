import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-context';
import { BrandIcon } from '@/ui/brand-icons';

const iconNames={index:'route',deals:'deals',chats:'chats',profile:'profile'} as const;
export default function TabsLayout(){
  const{booting,user}=useAuth();const{colors}=useAppTheme();
  if(!booting&&!user)return <Redirect href="/auth"/>;
  if(!booting&&user?.staffRole)return <Redirect href="/staff"/>;
  return <Tabs screenOptions={({route})=>({
    headerShown:false,
    tabBarStyle:{position:'absolute',left:12,right:12,bottom:12,height:66,paddingTop:8,paddingBottom:7,backgroundColor:colors.nav,borderTopWidth:0,borderWidth:1,borderColor:colors.border,borderRadius:22,elevation:8,shadowColor:colors.shadow,shadowOpacity:.14,shadowRadius:20,shadowOffset:{width:0,height:7}},
    tabBarActiveTintColor:colors.accent,tabBarInactiveTintColor:colors.muted,
    tabBarLabelStyle:{fontSize:9,fontWeight:'900',letterSpacing:.45,marginTop:2},tabBarHideOnKeyboard:true,
    tabBarIcon:({color})=><BrandIcon name={iconNames[route.name as keyof typeof iconNames]??'route'} color={color} size={19}/>,
  })}>
    <Tabs.Screen name="index" options={{title:'МАРШРУТИ'}}/><Tabs.Screen name="deals" options={{title:'УГОДИ'}}/><Tabs.Screen name="chats" options={{title:'ЧАТИ'}}/><Tabs.Screen name="profile" options={{title:'ПРОФІЛЬ'}}/>
  </Tabs>;
}
