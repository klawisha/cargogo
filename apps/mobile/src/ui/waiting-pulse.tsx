import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, Pressable, Text, View } from 'react-native';
import { BadgerMark } from '@/ui/badger-mark';
import { colors,radii,themedStyleSheet } from '@/theme/tokens';

const RUNNER_HERO=require('../../assets/brand/badger-run-hero.png');
const RUNNER_TOKEN=require('../../assets/brand/badger-run-token.png');
const BEST_KEY='cargogo.badger-run.best.v3';
const NODE_COUNT=9;

export function WaitingPulse(){
  const[index,setIndex]=useState(0);const[target,setTarget]=useState(5);const[streak,setStreak]=useState(0);const[best,setBest]=useState(0);const[round,setRound]=useState(1);const[lives,setLives]=useState(3);
  const[message,setMessage]=useState('Зловіть маяк, коли медоїд увійде в ціль');
  const pulse=useRef(new Animated.Value(0)).current;
  useEffect(()=>{void SecureStore.getItemAsync(BEST_KEY).then(v=>setBest(Number(v)||0)).catch(()=>{})},[]);
  useEffect(()=>{const speed=Math.max(215,500-Math.min(streak,8)*31);const t=setInterval(()=>setIndex(v=>(v+1)%NODE_COUNT),speed);return()=>clearInterval(t)},[streak]);
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1,duration:760,useNativeDriver:true}),Animated.timing(pulse,{toValue:0,duration:760,useNativeDriver:true})]));a.start();return()=>a.stop()},[pulse]);
  const nodes=useMemo(()=>Array.from({length:NODE_COUNT},(_,i)=>i),[]);
  async function tap(){const distance=Math.min(Math.abs(index-target),NODE_COUNT-Math.abs(index-target));if(distance===0){const next=streak+1;const nextBest=Math.max(best,next);setStreak(next);setBest(nextBest);setRound(r=>r+1);setLives(v=>Math.min(3,v+1));setMessage(next>=6?'Потік · медоїд тримає максимальний темп':next>=3?'Серія росте · маршрут прискорився':'Точно в маяк · +1 до серії');setTarget((target+3+round)%NODE_COUNT);if(nextBest!==best)void SecureStore.setItemAsync(BEST_KEY,String(nextBest)).catch(()=>{});return}if(distance===1){setMessage('Майже · серія збережена');setTarget((target+4)%NODE_COUNT);return}setStreak(0);setRound(r=>r+1);setLives(v=>{const n=v-1;if(n<=0){setMessage('Новий заїзд · три спроби відновлено');return 3}setMessage(`Обʼїзд · залишилось ${n} спроби`);return n});setTarget((target+5+round)%NODE_COUNT)}
  const speed=Math.max(215,500-Math.min(streak,8)*31);
  return <View style={s.card}>
    <ImageBackground source={RUNNER_HERO} resizeMode="cover" imageStyle={s.heroImage} style={s.hero}>
      <View style={s.heroShade}/><View style={s.top}><View style={s.brand}><BadgerMark size={38}/><View><Text style={s.eye}>BADGER RUN</Text><Text style={s.title}>ROUTE PULSE</Text></View></View><View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{streak}</Text><Text style={s.statLabel}>СЕРІЯ</Text></View><View style={s.stat}><Text style={s.statValue}>{best}</Text><Text style={s.statLabel}>BEST</Text></View></View></View>
      <View style={s.heroFooter}><Text style={s.heroHint}>Медоїд біжить разом із вашим маршрутом</Text><View style={s.roundPill}><Text style={s.roundText}>RUN {round}</Text></View></View>
    </ImageBackground>
    <View style={s.game}>
      <View style={s.track}><View style={s.trackLine}/>{nodes.map(i=><View key={i} style={[s.node,i===target&&s.target]}>{i===target&&<Animated.View pointerEvents="none" style={[s.targetPulse,{opacity:pulse.interpolate({inputRange:[0,1],outputRange:[.16,.52]}),transform:[{scale:pulse.interpolate({inputRange:[0,1],outputRange:[.9,1.45]})}]}]}/>}{i===index&&<View style={s.runnerDot}><Image source={RUNNER_TOKEN} resizeMode="contain" style={s.runnerImage}/></View>}</View>)}</View>
      <View style={s.legend}><View><Text style={s.legendLabel}>ЖИТТЯ</Text><Text style={s.life}>{'●'.repeat(lives)}<Text style={s.deadLife}>{'●'.repeat(3-lives)}</Text></Text></View><View style={s.centerLegend}><Text style={s.legendLabel}>РАУНД</Text><Text style={s.legendValue}>{round}</Text></View><View style={s.rightLegend}><Text style={s.legendLabel}>ТЕМП</Text><Text style={s.legendValue}>{speed} ms</Text></View></View>
      <View style={s.row}><Text style={s.hint}>{message}</Text><Pressable onPress={tap} style={({pressed})=>[s.button,pressed&&s.buttonPressed]}><Text style={s.buttonText}>ЗЛОВИТИ</Text><Text style={s.buttonArrow}>↗</Text></Pressable></View>
    </View>
  </View>;
}

const s=themedStyleSheet(()=>({
  card:{marginTop:14,borderRadius:radii.xl,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface,overflow:'hidden',shadowColor:colors.shadow,shadowOpacity:.16,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:3},
  hero:{height:146,padding:15,justifyContent:'space-between'},heroImage:{opacity:.98},heroShade:{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'#02080D',opacity:.43},
  top:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:10},eye:{fontSize:9,fontWeight:'900',letterSpacing:1.7,color:'#FF8A3D'},title:{fontSize:17,fontWeight:'900',color:'#FFFFFF',marginTop:1,letterSpacing:.2},
  stats:{flexDirection:'row',gap:7},stat:{minWidth:48,paddingHorizontal:9,paddingVertical:7,borderRadius:11,backgroundColor:'rgba(5,10,16,.76)',borderWidth:1,borderColor:'rgba(255,255,255,.16)'},statValue:{color:'#FFFFFF',fontSize:14,fontWeight:'900',textAlign:'center'},statLabel:{color:'#B4BDC6',fontSize:6,fontWeight:'900',letterSpacing:.9,textAlign:'center'},
  heroFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},heroHint:{color:'#F4F4F2',fontSize:10,fontWeight:'800',flex:1},roundPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:radii.pill,backgroundColor:'rgba(5,10,16,.72)',borderWidth:1,borderColor:'rgba(255,255,255,.16)'},roundText:{color:'#DDE2E7',fontSize:7,fontWeight:'900',letterSpacing:1},
  game:{padding:15},track:{height:60,flexDirection:'row',alignItems:'center',gap:6,position:'relative'},trackLine:{position:'absolute',left:4,right:4,height:2,backgroundColor:colors.borderStrong},
  node:{height:13,flex:1,borderRadius:8,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},target:{borderColor:colors.accent,backgroundColor:colors.accentSoft},targetPulse:{position:'absolute',width:24,height:24,borderRadius:12,backgroundColor:colors.accent},
  runnerDot:{position:'absolute',zIndex:3,width:42,height:30,alignItems:'center',justifyContent:'center'},runnerImage:{width:42,height:28,borderRadius:8},
  legend:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',borderTopWidth:1,borderTopColor:colors.border,paddingTop:10,marginBottom:11},legendLabel:{color:colors.muted,fontSize:7,fontWeight:'900',letterSpacing:.9},legendValue:{color:colors.textSecondary,fontSize:9,fontWeight:'900',marginTop:2},life:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:2,marginTop:2},deadLife:{color:colors.borderStrong},centerLegend:{alignItems:'center'},rightLegend:{alignItems:'flex-end'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},hint:{flex:1,color:colors.textSecondary,fontSize:10,lineHeight:15},button:{minHeight:44,paddingHorizontal:15,borderRadius:radii.md,backgroundColor:colors.accent,borderWidth:1,borderColor:colors.accentStrong,flexDirection:'row',alignItems:'center',gap:9},buttonPressed:{transform:[{scale:.97}],opacity:.8},buttonText:{color:colors.accentText,fontSize:9,fontWeight:'900',letterSpacing:.8},buttonArrow:{color:colors.accentText,fontSize:14,fontWeight:'900'}
}));
