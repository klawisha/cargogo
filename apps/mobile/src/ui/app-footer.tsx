import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, themedStyleSheet } from '@/theme/tokens';

type Props={compact?:boolean};
export function AppFooter({compact=false}:Props){
  return <View style={s.wrap}>
    <View style={s.rule}/>
    <View style={s.brandRow}>
      <View style={s.brandBlock}>
        <Text style={s.brand}>CARGOGO</Text>
        <Text style={s.tagline}>Cargo delivery made simple, safe and transparent.</Text>
      </View>
      <View style={s.version}><Text style={s.versionKicker}>PRODUCT</Text><Text style={s.versionText}>v1.6.2</Text></View>
    </View>
    {!compact&&<>
      <View style={s.links}>
        <Pressable onPress={()=>router.push('/legal' as any)} style={s.link}><Text style={s.linkText}>LEGAL CENTER</Text></Pressable>
        <Pressable onPress={()=>router.push('/verification' as any)} style={s.link}><Text style={s.linkText}>TRUST & VERIFICATION</Text></Pressable>
      </View>
      <View style={s.credit}>
        <Text style={s.creditEye}>FOUNDED & DEVELOPED BY</Text>
        <Text style={s.name}>Vladyslav Kosianenko</Text>
        <Text style={s.roles}>Founder & CEO · Product Owner · Lead Full-Stack Engineer</Text>
        <Text style={s.roles}>Software Architect · DevOps Engineer · Business Analyst</Text>
      </View>
    </>}
    <Text style={s.copy}>© 2026 CargoGo. All rights reserved.</Text>
  </View>
}
const s=themedStyleSheet(()=>({
  wrap:{marginTop:30,paddingBottom:24},rule:{height:1,backgroundColor:colors.border,marginBottom:18},
  brandRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:14},brandBlock:{flex:1},brand:{color:colors.text,fontSize:16,fontWeight:'900',letterSpacing:1.2},tagline:{color:colors.muted,fontSize:9.5,lineHeight:15,marginTop:5,maxWidth:230},
  version:{alignItems:'flex-end'},versionKicker:{color:colors.muted,fontSize:7.5,fontWeight:'900',letterSpacing:1.2},versionText:{color:colors.textSecondary,fontSize:10,fontWeight:'800',marginTop:4},
  links:{flexDirection:'row',gap:8,marginTop:15,flexWrap:'wrap'},link:{borderWidth:1,borderColor:colors.borderStrong,borderRadius:radii.pill,paddingHorizontal:12,paddingVertical:8},linkText:{color:colors.textSecondary,fontSize:8,fontWeight:'900',letterSpacing:.7},
  credit:{marginTop:17,padding:14,backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border,borderRadius:radii.md},creditEye:{color:colors.accent,fontSize:7.5,fontWeight:'900',letterSpacing:1.2},name:{color:colors.text,fontSize:14,fontWeight:'900',marginTop:6},roles:{color:colors.textSecondary,fontSize:9,lineHeight:14,marginTop:3},
  copy:{color:colors.muted,fontSize:8.5,marginTop:15}
}));
