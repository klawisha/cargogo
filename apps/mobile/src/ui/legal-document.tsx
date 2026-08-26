import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radii, themedStyleSheet } from '@/theme/tokens';

function inline(text:string):ReactNode[]{
  const parts=text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part,i)=>part.startsWith('**')&&part.endsWith('**')
    ? <Text key={i} style={s.bold}>{part.slice(2,-2)}</Text>
    : <Text key={i}>{part}</Text>);
}
function normalized(text:string){return text.replace(/\*\*/g,'').replace(/^#+\s*/,'').trim().toLocaleLowerCase('uk-UA')}
export function LegalDocument({content,title}:{content:string;title?:string}){
  const lines=content.replace(/\r/g,'').split('\n');
  const nodes:ReactNode[]=[];let quote:string[]=[];let firstHeading=true;
  const flushQuote=()=>{if(!quote.length)return;nodes.push(<View key={`q-${nodes.length}`} style={s.notice}><Text style={s.noticeEye}>LEGAL NOTICE</Text><Text style={s.noticeText}>{inline(quote.join(' '))}</Text></View>);quote=[]};
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];const t=raw.trim();
    if(t.startsWith('>')){quote.push(t.replace(/^>\s?/,''));continue}
    flushQuote();
    if(!t)continue;
    const heading=t.match(/^(#{1,3})\s+(.+)$/);
    if(heading){
      if(firstHeading&&title&&normalized(heading[2])===normalized(title)){firstHeading=false;continue}
      firstHeading=false;const level=heading[1].length;
      nodes.push(<Text key={`h-${i}`} style={level===1?s.h1:level===2?s.h2:s.h3}>{inline(heading[2])}</Text>);continue;
    }
    const bullet=t.match(/^[-*]\s+(.+)$/);
    if(bullet){nodes.push(<View key={`b-${i}`} style={s.bulletRow}><Text style={s.bullet}>•</Text><Text style={s.body}>{inline(bullet[1])}</Text></View>);continue}
    const numbered=t.match(/^(\d+)[.)]\s+(.+)$/);
    if(numbered){nodes.push(<View key={`n-${i}`} style={s.bulletRow}><Text style={s.number}>{numbered[1]}.</Text><Text style={s.body}>{inline(numbered[2])}</Text></View>);continue}
    nodes.push(<Text key={`p-${i}`} style={s.body}>{inline(t)}</Text>);
  }
  flushQuote();return <View style={s.doc}>{nodes}</View>
}
const s=themedStyleSheet(()=>({
  doc:{paddingBottom:8},notice:{backgroundColor:colors.accentSoft,borderLeftWidth:3,borderLeftColor:colors.accent,borderRadius:radii.sm,padding:13,marginBottom:20},noticeEye:{color:colors.accent,fontSize:8,fontWeight:'900',letterSpacing:1.1,marginBottom:6},noticeText:{color:colors.textSecondary,fontSize:11.5,lineHeight:18},
  h1:{color:colors.text,fontSize:22,fontWeight:'900',lineHeight:28,marginTop:18,marginBottom:9},h2:{color:colors.text,fontSize:17,fontWeight:'900',lineHeight:23,marginTop:20,marginBottom:8},h3:{color:colors.text,fontSize:14,fontWeight:'900',lineHeight:20,marginTop:16,marginBottom:6},
  body:{color:colors.textSecondary,fontSize:12.5,lineHeight:20,marginBottom:10,flex:1},bold:{color:colors.text,fontWeight:'900'},bulletRow:{flexDirection:'row',alignItems:'flex-start',gap:9,marginBottom:3},bullet:{color:colors.accent,fontSize:15,fontWeight:'900',lineHeight:20},number:{color:colors.accent,fontSize:11,fontWeight:'900',lineHeight:20,minWidth:20}
}));
