import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, Card, ErrorBox, Loading, Page, SectionTitle } from '@/components/Ui';
import { useNews } from '@/api/hooks';
import { colors, radius } from '@/theme';
import { freshFirst, markFreshRead, useFreshFeed } from '@/freshness';

function dateText(value:string|null){if(!value)return '최근';const d=new Date(value);return Number.isNaN(d.getTime())?'최근':d.toLocaleDateString('ko-KR',{month:'short',day:'numeric'});}

export default function AiNews(){
 const {width}=useWindowDimensions();const compact=width<370;const q=useNews();const raw=q.data?.items??[];
 const unread=useFreshFeed('news',raw.map(x=>({id:x.id,title:x.title,route:`/ai-news/${x.id}`})));
 const items=freshFirst(raw,unread);const ready=items.filter(x=>Boolean(x.summary));const pending=items.length-ready.length;const fresh=items.filter(x=>unread.has(String(x.id)));
 const lead=fresh[0]??ready[0]??items[0];const rest=lead?items.filter(x=>x.id!==lead.id):items;
 const open=(id:string)=>{void markFreshRead('news',id);router.push(`/ai-news/${id}`);};
 return <Page>
  <View style={[styles.hero,compact&&styles.heroCompact]}>
   <View style={styles.heroTop}><View style={{flex:1,minWidth:0}}><Text style={styles.eyebrow}>AI NEWS DESK</Text><Text style={[styles.heroTitle,compact&&{fontSize:27,lineHeight:33}]}>영상 대신{`\n`}핵심부터 읽어요.</Text></View><View style={styles.livePill}><View style={styles.liveDot}/><Text style={styles.liveText}>LIVE</Text></View></View>
   <Text style={styles.heroSub}>조코딩 AI 뉴스를 수집하고, 약 3분 분량의 맥락 중심 요약으로 정리합니다.</Text>
   <View style={styles.heroStats}><View style={styles.stat}><Text style={styles.statNum}>{ready.length}</Text><Text style={styles.statLabel}>요약 완료</Text></View><View style={styles.divider}/><View style={styles.stat}><Text style={styles.statNum}>{pending}</Text><Text style={styles.statLabel}>처리 중</Text></View><View style={styles.divider}/><View style={styles.stat}><Text style={styles.statNum}>{fresh.length}</Text><Text style={styles.statLabel}>새 소식</Text></View></View>
  </View>

  {q.isLoading&&<Loading/>}{q.error&&<ErrorBox message={q.error.message}/>}
  {!q.isLoading&&!q.error&&items.length===0?<Card><Text style={styles.empty}>아직 수집된 AI 뉴스가 없어요.</Text></Card>:null}

  {lead?<><SectionTitle title={unread.has(String(lead.id))?'방금 찾은 AI 뉴스':'오늘의 헤드라인'} subtitle={unread.has(String(lead.id))?'새로 수집된 뉴스부터 먼저 보여줘요.':'먼저 읽을 만한 한 편'} right={unread.has(String(lead.id))?<Badge tone="purple">NEW</Badge>:undefined}/><Pressable onPress={()=>open(lead.id)} style={({pressed})=>[styles.leadCard,unread.has(String(lead.id))&&styles.leadCardNew,pressed&&{opacity:.65}]}>
   <View style={styles.leadMeta}><View style={styles.badges}>{unread.has(String(lead.id))?<Badge tone="purple">NEW</Badge>:null}<Badge tone="purple">{lead.channel}</Badge></View><Text style={styles.date}>{dateText(lead.publishedAt)}</Text></View>
   <Text style={[styles.leadTitle,compact&&{fontSize:23,lineHeight:30}]}>{lead.title}</Text>
   <Text numberOfLines={4} style={styles.leadSummary}>{lead.summary??'요약을 준비하고 있어요. 완료되면 이 카드에서 바로 핵심 내용을 확인할 수 있습니다.'}</Text>
   <View style={styles.readRow}><Text style={styles.readText}>{lead.summary?'약 3분 읽기':'요약 준비 중'}</Text><Text style={styles.readArrow}>↗</Text></View>
  </Pressable></>:null}

  {rest.length>0?<><SectionTitle title="뉴스 인박스" subtitle={fresh.length>0?'NEW를 먼저, 그다음 기존 뉴스를 보여줘요.':'최신 영상과 요약을 한 줄씩 확인하세요.'}/><View style={styles.list}>{rest.map((x,index)=>{const isNew=unread.has(String(x.id));return <Pressable key={x.id} onPress={()=>open(x.id)} style={({pressed})=>[styles.row,isNew&&styles.rowNew,pressed&&{opacity:.6}]}>
   <View style={[styles.indexBox,isNew&&styles.indexBoxNew]}><Text style={styles.indexText}>{String(index+1).padStart(2,'0')}</Text></View>
   <View style={styles.rowBody}><View style={styles.rowMeta}><View style={styles.badges}>{isNew?<Badge tone="purple">NEW</Badge>:null}<Text style={styles.channel}>{x.channel}</Text></View><Text style={styles.date}>{dateText(x.publishedAt)}</Text></View><Text style={styles.title}>{x.title}</Text><Text numberOfLines={2} style={styles.summary}>{x.summary??'요약 생성 중 · 완료되면 자동으로 갱신됩니다.'}</Text><View style={styles.statusRow}><View style={[styles.statusDot,{backgroundColor:x.summary?colors.green:colors.orange}]}/><Text style={styles.statusText}>{x.summary?'요약 완료':'처리 중'}</Text></View></View>
   <Text style={styles.rowArrow}>↗</Text>
  </Pressable>})}</View></>:null}
 </Page>
}

const styles=StyleSheet.create({
 hero:{backgroundColor:'#6B48D6',borderRadius:28,padding:20,minHeight:250},heroCompact:{padding:17,borderRadius:24,minHeight:238},heroTop:{flexDirection:'row',alignItems:'flex-start',gap:12},eyebrow:{color:'#E5DCFF',fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:8},heroTitle:{color:'#fff',fontSize:31,lineHeight:37,fontWeight:'900',letterSpacing:-1.1},heroSub:{color:'#EAE4FA',fontSize:13,lineHeight:20,fontWeight:'600',marginTop:11,maxWidth:330},livePill:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:999,backgroundColor:'#FFFFFF1E',borderWidth:1,borderColor:'#FFFFFF2F',flexShrink:0},liveDot:{width:6,height:6,borderRadius:3,backgroundColor:'#FF9D8D'},liveText:{color:'#fff',fontSize:9,fontWeight:'900'},heroStats:{marginTop:'auto',paddingTop:23,flexDirection:'row',alignItems:'center'},stat:{flex:1,minWidth:0},statNum:{color:'#fff',fontSize:23,fontWeight:'900'},statLabel:{color:'#DDD3F5',fontSize:11,fontWeight:'700',marginTop:2},divider:{width:1,height:34,backgroundColor:'#FFFFFF2C',marginHorizontal:8},empty:{color:colors.muted,fontSize:13},
 leadCard:{backgroundColor:colors.surface,borderRadius:24,borderWidth:1,borderColor:colors.line,padding:18,gap:12},leadCardNew:{backgroundColor:'#FAF8FF',borderColor:'#DCCFFF'},leadMeta:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},badges:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},date:{color:colors.muted2,fontSize:10,fontWeight:'700'},leadTitle:{color:colors.text,fontSize:27,lineHeight:34,fontWeight:'900',letterSpacing:-.75},leadSummary:{color:'#595963',fontSize:14,lineHeight:22},readRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderTopWidth:1,borderTopColor:colors.line,paddingTop:12},readText:{color:colors.accentDark,fontSize:12,fontWeight:'900'},readArrow:{color:colors.accent,fontSize:18,fontWeight:'900'},
 list:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.line,overflow:'hidden'},row:{flexDirection:'row',gap:11,padding:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,alignItems:'flex-start'},rowNew:{backgroundColor:'#FAF8FF'},indexBox:{width:30,height:30,borderRadius:10,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center',flexShrink:0},indexBoxNew:{backgroundColor:'#E8DFFF'},indexText:{color:colors.accentDark,fontSize:10,fontWeight:'900'},rowBody:{flex:1,minWidth:0,gap:5},rowMeta:{flexDirection:'row',justifyContent:'space-between',gap:8},channel:{color:colors.accentDark,fontSize:10,fontWeight:'900'},title:{color:colors.text,fontSize:16,lineHeight:22,fontWeight:'900'},summary:{color:colors.muted,fontSize:12,lineHeight:18},statusRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:2},statusDot:{width:6,height:6,borderRadius:3},statusText:{color:colors.muted,fontSize:10,fontWeight:'700'},rowArrow:{color:colors.accent,fontSize:16,fontWeight:'900',flexShrink:0}
});
