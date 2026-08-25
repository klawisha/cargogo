import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, themedStyleSheet } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export function Screen({children}:PropsWithChildren){
  const{mode}=useAppTheme();
  return <SafeAreaView style={s.safe} edges={['top']}>
    <View style={s.glowA}/><View style={s.glowB}/>
    {mode==='badger'&&<><View style={s.badgerRailA}/><View style={s.badgerRailB}/><View style={s.badgerSun}/><View style={s.badgerDashA}/><View style={s.badgerDashB}/><View style={s.badgerDashC}/></>}
    <View style={s.content}>{children}</View>
  </SafeAreaView>;
}
const s=themedStyleSheet(()=>({
  safe:{flex:1,backgroundColor:colors.background},content:{flex:1,paddingHorizontal:spacing.md},
  glowA:{position:'absolute',width:190,height:190,borderRadius:95,backgroundColor:colors.accentSoft,opacity:.16,top:-95,right:-80},glowB:{position:'absolute',width:150,height:150,borderRadius:75,backgroundColor:colors.surfaceRaised,opacity:.22,bottom:80,left:-90},
  badgerRailA:{position:'absolute',width:'72%',height:1,backgroundColor:colors.accent,opacity:.16,right:-70,top:150,transform:[{rotate:'-28deg'}]},
  badgerRailB:{position:'absolute',width:'60%',height:1,backgroundColor:colors.borderStrong,opacity:.22,left:-90,bottom:190,transform:[{rotate:'24deg'}]},
  badgerSun:{position:'absolute',width:240,height:240,borderRadius:120,borderWidth:1,borderColor:colors.accent,opacity:.07,right:-120,top:-35},
  badgerDashA:{position:'absolute',width:42,height:3,borderRadius:2,backgroundColor:colors.accent,opacity:.12,right:72,top:176,transform:[{rotate:'-28deg'}]},
  badgerDashB:{position:'absolute',width:42,height:3,borderRadius:2,backgroundColor:colors.accent,opacity:.09,right:18,top:209,transform:[{rotate:'-28deg'}]},
  badgerDashC:{position:'absolute',width:42,height:3,borderRadius:2,backgroundColor:colors.accent,opacity:.08,right:-36,top:242,transform:[{rotate:'-28deg'}]},
}));
