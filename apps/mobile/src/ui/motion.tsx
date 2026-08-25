import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

export function FadeInView({children,delay=0,style}:{children:PropsWithChildren['children'];delay?:number;style?:StyleProp<ViewStyle>}){
  const value=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(value,{toValue:1,duration:280,delay,useNativeDriver:true}).start()},[delay,value]);
  return <Animated.View style={[style,{opacity:value,transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[7,0]})}]}]}>{children}</Animated.View>;
}

export function PulseDot({color,size=7}:{color:string;size?:number}){
  const pulse=useRef(new Animated.Value(0)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1,duration:950,useNativeDriver:true}),Animated.timing(pulse,{toValue:0,duration:950,useNativeDriver:true})]));a.start();return()=>a.stop()},[pulse]);
  return <Animated.View style={{width:size,height:size,borderRadius:size/2,backgroundColor:color,opacity:pulse.interpolate({inputRange:[0,1],outputRange:[.55,1]}),transform:[{scale:pulse.interpolate({inputRange:[0,1],outputRange:[.86,1.14]})}]}}/>;
}
