import { Text, View } from 'react-native';
import { BadgerMark } from '@/ui/badger-mark';
import { colors, themedStyleSheet } from '@/theme/tokens';

export function BrandLogo({compact=false}:{compact?:boolean}){
  return <View style={s.row} accessibilityLabel="CargoGo">
    <BadgerMark size={compact?34:42}/>
    <View>
      <Text style={[s.word,compact&&s.wordCompact]}>Cargo<Text style={s.go}>Go</Text></Text>
      {!compact&&<Text style={s.tag}>SMART ROUTES · VERIFIED DEALS</Text>}
    </View>
  </View>;
}
const s=themedStyleSheet(()=>({
  row:{flexDirection:'row',alignItems:'center',gap:10},
  word:{color:colors.text,fontSize:30,fontWeight:'900',letterSpacing:-1.3},
  wordCompact:{fontSize:26},
  go:{color:colors.accent},
  tag:{color:colors.muted,fontSize:7,fontWeight:'900',letterSpacing:1.05,marginTop:1},
}));
