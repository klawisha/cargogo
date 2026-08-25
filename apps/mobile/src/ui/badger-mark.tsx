import { Image, View } from 'react-native';
import { colors, themedStyleSheet } from '@/theme/tokens';

const BADGER_MARK=require('../../assets/brand/badger-mark-512.png');

export function BadgerMark({size=38,quiet=false}:{size?:number;quiet?:boolean}){
  const radius=Math.round(size*.29);
  return <View accessibilityLabel="CargoGo badger mark" style={[s.wrap,{width:size,height:size,borderRadius:radius},quiet&&s.quiet]}>
    <View pointerEvents="none" style={[s.glow,{borderRadius:radius}]}/>
    <Image source={BADGER_MARK} resizeMode="contain" style={s.image}/>
    <View pointerEvents="none" style={[s.rim,{borderRadius:radius}]}/>
  </View>;
}

const s=themedStyleSheet(()=>({
  wrap:{overflow:'hidden',backgroundColor:'#050D13',borderWidth:1,borderColor:colors.borderStrong,alignItems:'center',justifyContent:'center'},
  quiet:{borderColor:colors.border},
  image:{width:'94%',height:'94%'},
  glow:{position:'absolute',left:'14%',right:'14%',bottom:'5%',height:'18%',backgroundColor:colors.accent,opacity:.12},
  rim:{position:'absolute',left:0,right:0,top:0,bottom:0,borderWidth:1,borderColor:colors.accent,opacity:.48},
}));
