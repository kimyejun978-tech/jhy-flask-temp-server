import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, Card, ErrorBox, Loading, Page, SectionTitle } from '@/components/Ui';
import { useTrends } from '@/api/hooks';
import type { TrendItem } from '@/types';
import { colors, radius } from '@/theme';
import { freshFirst, markFreshRead, useFreshFeed } from '@/freshness';

const CATEGORIES = ['전체','AI','백엔드','프론트엔드','모바일','클라우드/DevOps','임베디드/IoT','보안','데이터','CS/아키텍처','언어/개발도구'] as const;
type Category = typeof CATEGORIES[number];
const RULES: Array<[Exclude<Category,'전체'>, RegExp]> = [
 ['AI', /(?:\bAI\b|인공지능|LLM|GPT|ChatGPT|OpenAI|Claude|Gemini|MCP|RAG|에이전트|머신러닝|딥러닝|생성형)/i],
 ['백엔드', /(?:백엔드|Backend|Spring|NestJS|Node\.?js|Express|FastAPI|Django|Flask|REST|GraphQL|API|서버|PostgreSQL|MySQL|MongoDB|Redis)/i],
 ['프론트엔드', /(?:프론트엔드|Frontend|React|Next\.?js|Vue|Svelte|Angular|JavaScript|TypeScript|HTML|CSS)/i],
 ['모바일', /(?:Android|iOS|Flutter|React Native|Expo|Kotlin|Swift|모바일)/i],
 ['클라우드/DevOps', /(?:Cloud|클라우드|AWS|GCP|Azure|Cloudflare|Docker|Kubernetes|K8s|DevOps|CI\/?CD|GitHub Actions|Terraform|배포|인프라)/i],
 ['임베디드/IoT', /(?:임베디드|Embedded|IoT|ESP32|Arduino|Raspberry\s*Pi|STM32|MCU|펌웨어|RTOS|GPIO|센서)/i],
 ['보안', /(?:보안|Security|취약점|CTF|OAuth|JWT|인증|암호화|XSS|CSRF|해킹)/i],
 ['데이터', /(?:데이터|Data|Pandas|NumPy|Spark|Kafka|ETL|SQL|분석|Analytics)/i],
 ['CS/아키텍처', /(?:자료구조|알고리즘|운영체제|OS\b|네트워크|TCP|UDP|HTTP|컴퓨터구조|아키텍처|Design Pattern|분산)/i],
 ['언어/개발도구', /(?:Rust|C\+\+|C언어|Python|Java\b|Go\b|Git\b|GitHub|VS\s*Code|Cursor|IDE|CLI|라이브러리|프레임워크)/i],
];
function categoriesOf(item: TrendItem): string[] { if (item.categories?.length) return item.categories; const text=`${item.title} ${item.tags.join(' ')} ${item.summary??''}`; return RULES.filter(([,r])=>r.test(text)).map(([n])=>n); }
function dateText(value:string|null){ if(!value)return '최근 수집';const d=new Date(value);return Number.isNaN(d.getTime())?'최근 수집':d.toLocaleDateString('ko-KR',{month:'short',day:'numeric'}); }

export default function Trends(){
 const {width}=useWindowDimensions();const compact=width<370;const q=useTrends();const [selected,setSelected]=useState<Category>('전체');
 const all=q.data?.items??[];
 const unread=useFreshFeed('trend',all.map(x=>({id:x.id,title:x.title,route:`/trend/${x.id}`})));
 const filtered=useMemo(()=>selected==='전체'?all:all.filter(i=>categoriesOf(i).includes(selected)),[all,selected]);
 const items=useMemo(()=>freshFirst(filtered,unread),[filtered,unread]);
 const counts=useMemo(()=>CATEGORIES.slice(1).map(name=>({name,count:all.filter(i=>categoriesOf(i).includes(name)).length})).sort((a,b)=>b.count-a.count),[all]);
 const top=counts.slice(0,3);const newCount=items.filter(x=>unread.has(String(x.id))).length;
 return <Page>
  <View style={[styles.hero,compact&&styles.heroCompact]}>
   <Text style={styles.eyebrow}>DEVELOPER SIGNALS</Text>
   <Text style={[styles.heroTitle,compact&&{fontSize:27,lineHeight:33}]}>이번 주 개발 흐름을{`\n`}한 화면에서 읽어요.</Text>
   <Text style={styles.heroSub}>Velog 인기 글을 분야별로 묶고, 읽을 이유와 다음 실습까지 연결합니다.</Text>
   <View style={styles.signalRow}>{top.map((x,i)=><View key={x.name} style={styles.signal}><Text style={styles.signalRank}>0{i+1}</Text><Text numberOfLines={1} style={styles.signalName}>{x.name}</Text><Text style={styles.signalCount}>{x.count}</Text></View>)}</View>
  </View>

  {newCount>0?<SectionTitle title="새로 찾은 글" subtitle="마지막 확인 이후 수집된 글을 맨 위로 올렸어요." right={<Badge tone="purple">{newCount} NEW</Badge>}/>:null}
  <View style={styles.filterRow}>{CATEGORIES.map(c=>{const active=c===selected;return <Pressable key={c} onPress={()=>setSelected(c)} style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{c}</Text></Pressable>})}</View>
  <SectionTitle title={selected==='전체'?'오늘 읽을 것':selected} subtitle={newCount>0?'NEW를 먼저, 그다음 기존 글을 보여줘요.':'카드보다 빠르게 훑을 수 있는 인박스형 목록'} right={!q.isLoading?<Text style={styles.count}>{items.length}</Text>:undefined}/>
  {q.isLoading&&<Loading/>}{q.error&&<ErrorBox message={q.error.message}/>}
  {!q.isLoading&&!q.error&&items.length===0?<Card><Text style={styles.empty}>아직 이 분야에 새 글이 없어요.</Text></Card>:null}
  <View style={styles.list}>{items.map((x,index)=>{const cats=categoriesOf(x);const isNew=unread.has(String(x.id));return <Pressable key={x.id} onPress={()=>{void markFreshRead('trend',x.id);router.push(`/trend/${x.id}`);}} style={({pressed})=>[styles.row,isNew&&styles.rowNew,pressed&&{opacity:.6}]}>
    <View style={styles.numberCol}><Text style={styles.number}>{String(index+1).padStart(2,'0')}</Text><View style={styles.line}/></View>
    <View style={styles.rowBody}>
     <View style={styles.rowHead}><View style={styles.badges}>{isNew?<Badge tone="purple">NEW</Badge>:null}{cats.slice(0,compact?1:2).map(c=><Badge tone="purple" key={c}>{c}</Badge>)}</View><Text style={styles.date}>{dateText(x.publishedAt)}</Text></View>
     <Text style={styles.title}>{x.title}</Text>
     {x.summary?<Text numberOfLines={2} style={styles.summary}>{x.summary}</Text>:null}
     <View style={styles.whyRow}><Text numberOfLines={1} style={styles.why}>{x.whyRead?`왜 읽나 · ${x.whyRead}`:'핵심 맥락을 정리 중이에요.'}</Text><Text style={styles.arrow}>↗</Text></View>
    </View>
   </Pressable>})}</View>
 </Page>
}

const styles=StyleSheet.create({
 hero:{backgroundColor:'#6C49D8',borderRadius:28,padding:20,minHeight:250,overflow:'hidden'},heroCompact:{padding:17,minHeight:238,borderRadius:24},
 eyebrow:{color:'#E6DEFF',fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:8},heroTitle:{color:'#fff',fontSize:31,lineHeight:37,fontWeight:'900',letterSpacing:-1.1},heroSub:{color:'#E9E3F8',fontSize:13,lineHeight:20,fontWeight:'600',marginTop:10,maxWidth:330},
 signalRow:{flexDirection:'row',gap:7,marginTop:'auto',paddingTop:22},signal:{flex:1,minWidth:0,backgroundColor:'#FFFFFF17',borderWidth:1,borderColor:'#FFFFFF20',borderRadius:15,padding:10,gap:2},signalRank:{color:'#CFC1FF',fontSize:9,fontWeight:'900'},signalName:{color:'#fff',fontSize:11,fontWeight:'800'},signalCount:{color:'#fff',fontSize:19,fontWeight:'900'},
 filterRow:{flexDirection:'row',flexWrap:'wrap',gap:7},filter:{paddingHorizontal:11,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},filterActive:{backgroundColor:colors.text,borderColor:colors.text},filterText:{color:colors.muted,fontSize:11,fontWeight:'800'},filterTextActive:{color:'#fff'},count:{color:colors.muted,fontSize:12,fontWeight:'800'},empty:{color:colors.muted,fontSize:13},
 list:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:radius.lg,overflow:'hidden'},row:{flexDirection:'row',gap:12,paddingHorizontal:14,paddingTop:15,minHeight:132,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},rowNew:{backgroundColor:'#FAF8FF'},numberCol:{width:27,alignItems:'center',flexShrink:0},number:{color:colors.accent,fontSize:10,fontWeight:'900'},line:{width:1,backgroundColor:colors.line,flex:1,marginTop:8},rowBody:{flex:1,minWidth:0,paddingBottom:15,gap:7},rowHead:{flexDirection:'row',justifyContent:'space-between',gap:8,alignItems:'center'},badges:{flexDirection:'row',flexWrap:'wrap',gap:5,flex:1},date:{color:colors.muted2,fontSize:10,fontWeight:'700',flexShrink:0},title:{color:colors.text,fontSize:17,lineHeight:23,fontWeight:'900',letterSpacing:-.35},summary:{color:'#5F5F69',fontSize:12,lineHeight:18},whyRow:{flexDirection:'row',alignItems:'center',gap:8},why:{color:colors.muted,fontSize:11,lineHeight:17,flex:1},arrow:{color:colors.accent,fontSize:16,fontWeight:'800'}
});
