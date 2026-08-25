import { useLocalSearchParams, router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, Button, ErrorBox, Loading, Page, SectionTitle } from '@/components/Ui';
import { useTrend } from '@/api/hooks';
import { colors } from '@/theme';

export default function TrendDetail(){
 const {width}=useWindowDimensions();const compact=width<370;const {id}=useLocalSearchParams<{id:string}>();const q=useTrend(id);
 if(q.isLoading)return <Page><Loading/></Page>;if(q.error||!q.data)return <Page><ErrorBox message={q.error?.message??'글을 찾을 수 없습니다.'}/></Page>;
 const x=q.data;const categories=Array.isArray(x.categories)?x.categories:[];const date=x.publishedAt?new Date(x.publishedAt).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}):'최근 수집';
 return <Page>
  <View style={styles.topbar}><Pressable onPress={()=>router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.topTitle}>트렌드</Text><Pressable onPress={()=>Linking.openURL(x.url)} style={styles.open}><Text style={styles.openText}>↗</Text></Pressable></View>
  <View style={[styles.hero,compact&&styles.heroCompact]}><Text style={styles.eyebrow}>DEVELOPER SIGNAL</Text><Text style={[styles.title,compact&&{fontSize:26,lineHeight:33}]}>{x.title}</Text><Text style={styles.meta}>{x.author??'작성자 확인 중'} · {date}</Text><View style={styles.tags}>{categories.slice(0,4).map(c=><Badge tone="purple" key={c}>{c}</Badge>)}</View></View>
  {x.tags.length>0?<View style={styles.rawTags}><Text style={styles.rawLabel}>원문 태그</Text><Text style={styles.rawText}>{x.tags.slice(0,8).join(' · ')}</Text></View>:null}
  <SectionTitle title="한 줄 요약"/><Text style={styles.lead}>{x.summary??'요약을 생성하고 있어요.'}</Text>
  <View style={styles.divider}/>
  <SectionTitle title="왜 알아두면 좋은가"/><Text style={styles.body}>{x.whyRead??'이 글이 왜 중요한지 정리하고 있어요.'}</Text>
  <View style={styles.practice}><Text style={styles.practiceEyebrow}>TRY NEXT</Text><Text style={styles.practiceTitle}>읽고 끝내지 말고, 하나 해보기.</Text><Text style={styles.practiceBody}>{x.tryNext??'실습 제안을 준비하고 있어요.'}</Text></View>
  <Button label="Velog 원문 읽기" onPress={()=>Linking.openURL(x.url)}/>
 </Page>
}

const styles=StyleSheet.create({topbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:29,lineHeight:31},topTitle:{color:colors.text,fontSize:14,fontWeight:'900'},open:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},openText:{color:colors.accent,fontSize:17,fontWeight:'900'},hero:{backgroundColor:'#EEE9FF',borderRadius:28,padding:20,minHeight:230,gap:11},heroCompact:{padding:17,borderRadius:24,minHeight:220},eyebrow:{color:colors.accentDark,fontSize:10,fontWeight:'900',letterSpacing:1.8},title:{color:colors.text,fontSize:30,lineHeight:38,fontWeight:'900',letterSpacing:-.9},meta:{color:colors.muted,fontSize:12,fontWeight:'700'},tags:{marginTop:'auto',paddingTop:14,flexDirection:'row',flexWrap:'wrap',gap:6},rawTags:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:17,padding:14,gap:5},rawLabel:{color:colors.muted2,fontSize:9,fontWeight:'900',letterSpacing:1.1},rawText:{color:colors.muted,fontSize:11,lineHeight:17},lead:{color:colors.text,fontSize:21,lineHeight:31,fontWeight:'800',letterSpacing:-.45},divider:{height:1,backgroundColor:colors.line},body:{color:'#50505A',fontSize:15,lineHeight:25},practice:{backgroundColor:'#6D49D9',borderRadius:24,padding:18,gap:8},practiceEyebrow:{color:'#DCD1FF',fontSize:9,fontWeight:'900',letterSpacing:1.6},practiceTitle:{color:'#fff',fontSize:19,lineHeight:25,fontWeight:'900'},practiceBody:{color:'#EAE3FA',fontSize:13,lineHeight:21}});
