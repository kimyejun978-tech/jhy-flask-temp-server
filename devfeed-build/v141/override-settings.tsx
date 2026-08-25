import { Alert, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { getUserDisplayId } from '@/api/client';
import { usePreferences, useSavePreferences, type Preferences } from '@/api/hooks';
import { Badge, Button, Card, Loading, Page, SectionTitle } from '@/components/Ui';
import { colors, radius } from '@/theme';
import {
  currentAppVersion,
  downloadAndInstallUpdate,
  getAvailableUpdate,
  type UpdateDownloadProgress,
  type UpdateInfo,
} from '@/updater';

const defaults:Preferences={eventsEnabled:true,trendsEnabled:true,newsEnabled:true,freePriority:true,highSchoolOnly:false,deadline3Enabled:true,deadline1Enabled:true,eventDayBeforeEnabled:true,interests:['AI','로봇','임베디드','IoT','SW','해커톤']};
const interests=['AI','로봇','임베디드','IoT','SW','해커톤'];

function formatBytes(value:number){
 if(!Number.isFinite(value)||value<=0)return '0 MB';
 const mb=value/(1024*1024);
 return mb>=10?`${mb.toFixed(1)} MB`:`${mb.toFixed(2)} MB`;
}

function ToggleRow({title,subtitle,value,onChange}:{title:string;subtitle?:string;value:boolean;onChange:(v:boolean)=>void}){
 return <View style={styles.toggleRow}><View style={{flex:1,minWidth:0}}><Text style={styles.toggleTitle}>{title}</Text>{subtitle?<Text style={styles.toggleSub}>{subtitle}</Text>:null}</View><Switch value={value} onValueChange={onChange} trackColor={{false:'#DADAE2',true:'#B8A7FF'}} thumbColor={value?colors.accent:'#fff'}/></View>
}

export default function Settings(){
 const {width}=useWindowDimensions();const compact=width<370;const q=usePreferences();const save=useSavePreferences();const [p,setP]=useState<Preferences>(defaults);const [permission,setPermission]=useState('확인 중');const [profileId,setProfileId]=useState('불러오는 중');const [updateStatus,setUpdateStatus]=useState('확인 안 함');const [updateInfo,setUpdateInfo]=useState<UpdateInfo|null>(null);const [installing,setInstalling]=useState(false);const [downloadProgress,setDownloadProgress]=useState<UpdateDownloadProgress|null>(null);
 useEffect(()=>{if(q.data)setP(q.data)},[q.data]);
 useEffect(()=>{Notifications.getPermissionsAsync().then(v=>setPermission(v.status==='granted'?'허용됨':'권한 필요')).catch(()=>setPermission('확인 필요'));getUserDisplayId().then(setProfileId).catch(()=>setProfileId('확인 필요'))},[]);
 const set=(k:keyof Preferences,v:boolean|string[])=>setP(prev=>({...prev,[k]:v}));const toggleInterest=(x:string)=>set('interests',p.interests.includes(x)?p.interests.filter(v=>v!==x):[...p.interests,x]);
 const persist=async()=>{try{await save.mutateAsync(p);Alert.alert('저장 완료','이 기기의 DevFeed 설정을 저장했어요.')}catch(e){Alert.alert('저장 실패',e instanceof Error?e.message:'다시 시도해주세요.')}};
 const enableNotifications=async()=>{try{const perm=await Notifications.requestPermissionsAsync();const granted=perm.status==='granted';setPermission(granted?'허용됨':'권한 필요');Alert.alert(granted?'알림 준비 완료':'알림 권한 필요',granted?'선택한 관심 분야와 마감 기준으로 알림을 받을 수 있어요.':'휴대폰 설정에서 DevFeed 알림을 허용해주세요.')}catch(e){Alert.alert('알림 설정',e instanceof Error?e.message:'권한 요청에 실패했습니다.')}};
 const checkUpdate=async()=>{try{setUpdateStatus('확인 중…');setUpdateInfo(null);setDownloadProgress(null);const info=await getAvailableUpdate();if(info){setUpdateInfo(info);setUpdateStatus(`v${info.latestVersion} 사용 가능`)}else setUpdateStatus('최신 버전입니다')}catch(e){setUpdateStatus('확인 실패');Alert.alert('업데이트 확인 실패',e instanceof Error?e.message:'업데이트 정보를 불러오지 못했습니다.')}};
 const installUpdate=async()=>{if(!updateInfo)return;try{setInstalling(true);setDownloadProgress({percent:0,downloadedBytes:0,totalBytes:updateInfo.size??0});setUpdateStatus('다운로드 중');await downloadAndInstallUpdate(updateInfo,progress=>{setDownloadProgress(progress);setUpdateStatus(progress.percent>=100?'설치 준비 중…':'다운로드 중')});setUpdateStatus('설치 화면을 확인해주세요')}catch(e){setUpdateStatus('업데이트 실패');Alert.alert('업데이트 실패',e instanceof Error?e.message:'업데이트를 설치하지 못했습니다.')}finally{setInstalling(false)}};
 if(q.isLoading)return <Page><Loading/></Page>;
 return <Page>
   <View style={[styles.hero,compact&&styles.heroCompact]}><Text style={styles.eyebrow}>PERSONAL WORKSPACE</Text><Text style={[styles.heroTitle,compact&&{fontSize:27}]}>내 DevFeed를{`\n`}내 방식대로.</Text><Text style={styles.heroSub}>어떤 행사를 먼저 보고, 언제 알림 받을지 한 곳에서 조정합니다.</Text><View style={styles.profileRow}><View style={styles.avatar}><Text style={styles.avatarText}>D</Text></View><View style={{flex:1,minWidth:0}}><Text style={styles.profileLabel}>이 기기 프로필</Text><Text numberOfLines={1} style={styles.profileId}>{profileId}</Text></View><Badge tone="green">로컬 저장</Badge></View></View>

   <SectionTitle title="관심 분야" subtitle="홈과 알림에서 우선해서 보여줄 주제"/>
   <View style={styles.chips}>{interests.map(x=>{const active=p.interests.includes(x);return <Pressable key={x} onPress={()=>toggleInterest(x)} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{active?'✓ ':''}{x}</Text></Pressable>})}</View>

   <SectionTitle title="행사 필터" subtitle="내가 볼 수 있는 행사를 더 먼저 보여줘요."/>
   <Card style={styles.sectionCard}><ToggleRow title="행사 알림" subtitle="새 행사와 중요한 변경사항" value={p.eventsEnabled} onChange={v=>set('eventsEnabled',v)}/><View style={styles.line}/><ToggleRow title="고등학생 참가 가능만" value={p.highSchoolOnly} onChange={v=>set('highSchoolOnly',v)}/><View style={styles.line}/><ToggleRow title="무료 행사 우선" value={p.freePriority} onChange={v=>set('freePriority',v)}/></Card>

   <SectionTitle title="마감 알림" subtitle="신청과 행사 날짜를 놓치지 않도록"/>
   <Card style={styles.sectionCard}><ToggleRow title="신청 마감 3일 전" value={p.deadline3Enabled} onChange={v=>set('deadline3Enabled',v)}/><View style={styles.line}/><ToggleRow title="신청 마감 1일 전" value={p.deadline1Enabled} onChange={v=>set('deadline1Enabled',v)}/><View style={styles.line}/><ToggleRow title="행사 하루 전" value={p.eventDayBeforeEnabled} onChange={v=>set('eventDayBeforeEnabled',v)}/></Card>

   <SectionTitle title="콘텐츠 알림"/>
   <Card style={styles.sectionCard}><ToggleRow title="개발 트렌드" subtitle="새로운 주요 Velog 글" value={p.trendsEnabled} onChange={v=>set('trendsEnabled',v)}/><View style={styles.line}/><ToggleRow title="AI 뉴스" subtitle="조코딩 새 영상과 요약" value={p.newsEnabled} onChange={v=>set('newsEnabled',v)}/></Card>
   <Button label={save.isPending?'저장 중…':'설정 저장'} disabled={save.isPending} onPress={()=>void persist()}/>

   <SectionTitle title="앱 업데이트" subtitle="APK를 다시 찾아다니지 않아도 앱 안에서 업데이트합니다."/>
   <Card>
    <View style={styles.updateHead}><View><Text style={styles.updateTitle}>DevFeed</Text><Text style={styles.updateVersion}>현재 v{currentAppVersion()}</Text></View><Badge tone={updateInfo?'orange':'neutral'}>{updateStatus}</Badge></View>
    {installing&&downloadProgress?<View style={styles.progressBox}>
      <View style={styles.progressTop}><Text style={styles.progressPercent}>{downloadProgress.percent}%</Text><Text style={styles.progressBytes}>{formatBytes(downloadProgress.downloadedBytes)}{downloadProgress.totalBytes>0?` / ${formatBytes(downloadProgress.totalBytes)}`:''}</Text></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${downloadProgress.percent}%`}]} /></View>
      <Text style={styles.progressHint}>{downloadProgress.percent>=100?'다운로드 완료 · Android 설치 화면을 준비하고 있어요.':'APK를 다운로드하고 있어요. 앱을 종료하지 마세요.'}</Text>
    </View>:null}
    <Button label="업데이트 확인" variant="secondary" disabled={installing} onPress={()=>void checkUpdate()}/>{updateInfo?<Button label={installing?`다운로드 ${downloadProgress?.percent??0}%`:`v${updateInfo.latestVersion} 설치`} disabled={installing} onPress={()=>void installUpdate()}/>:null}
   </Card>

   <SectionTitle title="기기 권한"/>
   <Card><View style={styles.permissionRow}><View style={{flex:1,minWidth:0}}><Text style={styles.updateTitle}>백그라운드 알림</Text><Text style={styles.toggleSub}>기기별 관심 설정을 기준으로 서버를 확인합니다.</Text></View><Badge tone={permission==='허용됨'?'green':'orange'}>{permission}</Badge></View><Button label={permission==='허용됨'?'알림 권한 다시 확인':'알림 권한 허용'} variant="ghost" onPress={()=>void enableNotifications()}/></Card>
 </Page>
}

const styles=StyleSheet.create({
 hero:{backgroundColor:'#6D49D9',borderRadius:28,padding:20,minHeight:245},heroCompact:{padding:17,borderRadius:24,minHeight:235},eyebrow:{color:'#E7DEFF',fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:8},heroTitle:{color:'#fff',fontSize:31,lineHeight:37,fontWeight:'900',letterSpacing:-1.1},heroSub:{color:'#EAE4FA',fontSize:13,lineHeight:20,fontWeight:'600',marginTop:10,maxWidth:330},profileRow:{marginTop:'auto',paddingTop:22,flexDirection:'row',alignItems:'center',gap:10},avatar:{width:40,height:40,borderRadius:14,backgroundColor:'#FFFFFF22',borderWidth:1,borderColor:'#FFFFFF2D',alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontSize:17,fontWeight:'900'},profileLabel:{color:'#D9CFF3',fontSize:9,fontWeight:'800'},profileId:{color:'#fff',fontSize:12,fontWeight:'900',marginTop:2},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:13,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},chipActive:{backgroundColor:colors.accentSoft,borderColor:'#D8CCFF'},chipText:{color:colors.muted,fontSize:12,fontWeight:'800'},chipTextActive:{color:colors.accentDark},sectionCard:{paddingVertical:4},toggleRow:{minHeight:63,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},toggleTitle:{color:colors.text,fontSize:14,fontWeight:'900'},toggleSub:{color:colors.muted,fontSize:10,lineHeight:15,marginTop:3,maxWidth:260},line:{height:1,backgroundColor:colors.line},updateHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},updateTitle:{color:colors.text,fontSize:15,fontWeight:'900'},updateVersion:{color:colors.muted,fontSize:11,marginTop:3},permissionRow:{flexDirection:'row',alignItems:'center',gap:10},
 progressBox:{backgroundColor:colors.accentSoft2,borderRadius:16,padding:13,gap:9},progressTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},progressPercent:{color:colors.accentDark,fontSize:18,fontWeight:'900'},progressBytes:{color:colors.muted,fontSize:11,fontWeight:'800'},progressTrack:{height:9,borderRadius:99,backgroundColor:'#DED6F7',overflow:'hidden'},progressFill:{height:'100%',borderRadius:99,backgroundColor:colors.accent},progressHint:{color:colors.muted,fontSize:10,lineHeight:15,fontWeight:'600'}
});
