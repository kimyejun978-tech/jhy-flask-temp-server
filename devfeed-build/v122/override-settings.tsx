import { Alert, Switch, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { getUserDisplayId } from '@/api/client';
import { usePreferences, useSavePreferences, type Preferences } from '@/api/hooks';
import { Card, Loading, Page, ui } from '@/components/Ui';
import { currentAppVersion, downloadAndInstallUpdate, getAvailableUpdate, type UpdateInfo } from '@/updater';

const Row=({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void})=><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={ui.body}>{label}</Text><Switch value={value} onValueChange={onChange}/></View>;
const defaults:Preferences={eventsEnabled:true,trendsEnabled:true,newsEnabled:true,freePriority:true,highSchoolOnly:false,deadline3Enabled:true,deadline1Enabled:true,eventDayBeforeEnabled:true,interests:['AI','로봇','임베디드','IoT','SW','해커톤']};

export default function Settings(){
 const q=usePreferences(); const save=useSavePreferences(); const [p,setP]=useState<Preferences>(defaults); const [permission,setPermission]=useState<string>('확인 중'); const [profileId,setProfileId]=useState('불러오는 중');
 const [updateStatus,setUpdateStatus]=useState('확인 안 함'); const [updateInfo,setUpdateInfo]=useState<UpdateInfo|null>(null); const [installing,setInstalling]=useState(false);
 useEffect(()=>{if(q.data)setP(q.data)},[q.data]);
 useEffect(()=>{Notifications.getPermissionsAsync().then(v=>setPermission(v.status==='granted'?'허용됨':'허용 필요')).catch(()=>setPermission('확인 필요'));getUserDisplayId().then(setProfileId).catch(()=>setProfileId('확인 필요'));},[]);
 const set=(k:keyof Preferences,v:boolean|string[])=>setP(prev=>({...prev,[k]:v}));
 const toggleInterest=(x:string)=>set('interests',p.interests.includes(x)?p.interests.filter(v=>v!==x):[...p.interests,x]);
 const persist=async()=>{try{await save.mutateAsync(p);Alert.alert('저장 완료','이 기기 프로필의 설정으로 저장했습니다.')}catch(e){Alert.alert('저장 실패',e instanceof Error?e.message:'오류')}};
 const enableNotifications=async()=>{try{const perm=await Notifications.requestPermissionsAsync();const granted=perm.status==='granted';setPermission(granted?'허용됨':'허용 필요');Alert.alert(granted?'알림 준비 완료':'알림 권한 필요',granted?'이 기기의 개인 설정을 기준으로 새 행사·트렌드·AI 뉴스와 마감 알림을 확인합니다.':'휴대폰 설정에서 DevFeed 알림을 허용해주세요.');}catch(e){Alert.alert('알림 설정',e instanceof Error?e.message:'권한 요청에 실패했습니다.')}};
 const checkUpdate=async()=>{try{setUpdateStatus('확인 중...');setUpdateInfo(null);const info=await getAvailableUpdate();if(info){setUpdateInfo(info);setUpdateStatus(`v${info.latestVersion} 사용 가능`);}else setUpdateStatus('최신 버전입니다');}catch(e){setUpdateStatus('확인 실패');Alert.alert('업데이트 확인 실패',e instanceof Error?e.message:'업데이트 정보를 불러오지 못했습니다.')}};
 const installUpdate=async()=>{if(!updateInfo)return;try{setInstalling(true);setUpdateStatus('APK 다운로드 중...');await downloadAndInstallUpdate(updateInfo);setUpdateStatus('설치 화면을 확인해주세요');}catch(e){setUpdateStatus('업데이트 실패');Alert.alert('업데이트 실패',e instanceof Error?e.message:'업데이트를 설치하지 못했습니다.')}finally{setInstalling(false)}};
 if(q.isLoading)return <Page><Loading/></Page>;
 return <Page>
  <Text style={[ui.h2,{fontSize:28}]}>설정</Text>
  <Card>
   <Text style={ui.h2}>내 프로필</Text>
   <Text style={ui.body}>이 기기 프로필 {profileId}</Text>
   <Text style={ui.muted}>친구가 같은 APK를 설치해도 관심 행사, 참가 예정, 알림 설정은 서로 섞이지 않습니다.</Text>
   <Text style={[ui.muted,{paddingTop:6}]}>Google 로그인은 다음 단계에서 연결하면 여러 기기 사이에서도 같은 프로필을 복구할 수 있어요.</Text>
  </Card>
  <Card><Row label="행사 알림" value={p.eventsEnabled} onChange={v=>set('eventsEnabled',v)}/><Row label="고등학생 참가 가능만" value={p.highSchoolOnly} onChange={v=>set('highSchoolOnly',v)}/><Row label="무료 행사 우선" value={p.freePriority} onChange={v=>set('freePriority',v)}/></Card>
  <Card><Text style={ui.h2}>관심 분야</Text>{['AI','로봇','임베디드','IoT','SW','해커톤'].map(x=><Row key={x} label={x} value={p.interests.includes(x)} onChange={()=>toggleInterest(x)}/>)}</Card>
  <Card><Text style={ui.h2}>마감/행사 알림</Text><Row label="신청 마감 3일 전" value={p.deadline3Enabled} onChange={v=>set('deadline3Enabled',v)}/><Row label="신청 마감 1일 전" value={p.deadline1Enabled} onChange={v=>set('deadline1Enabled',v)}/><Row label="행사 하루 전" value={p.eventDayBeforeEnabled} onChange={v=>set('eventDayBeforeEnabled',v)}/></Card>
  <Card><Row label="주요 트렌드 알림" value={p.trendsEnabled} onChange={v=>set('trendsEnabled',v)}/><Row label="조코딩 새 영상 알림" value={p.newsEnabled} onChange={v=>set('newsEnabled',v)}/></Card>
  <Text style={[ui.body,{fontWeight:'900',textAlign:'center',padding:12}]} onPress={persist}>설정 저장</Text>
  <Card>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={ui.h2}>앱 업데이트</Text><Text style={ui.muted}>v{currentAppVersion()}</Text></View>
   <Text style={ui.muted}>새 버전이 있으면 앱 안에서 APK를 다운로드하고 Android 설치 화면을 바로 엽니다. 이후에는 별도 APK 링크를 받을 필요가 없습니다.</Text>
   <Text style={[ui.body,{fontWeight:'900',paddingTop:8}]} onPress={checkUpdate}>업데이트 확인 →</Text>
   <Text style={[ui.muted,{paddingTop:4}]}>{updateStatus}</Text>
   {updateInfo?<Text style={[ui.body,{fontWeight:'900',paddingTop:8}]} onPress={installing?undefined:installUpdate}>{installing?'다운로드 중...':`v${updateInfo.latestVersion} 다운로드 및 설치 →`}</Text>:null}
  </Card>
  <Card>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={ui.h2}>백그라운드 알림</Text><Text style={ui.muted}>{permission}</Text></View>
   <Text style={ui.muted}>EAS 없이 Android가 주기적으로 DevFeed 서버를 확인합니다. 이 기기 프로필의 관심/알림 설정이 적용됩니다.</Text>
   <Text style={[ui.body,{fontWeight:'900',paddingTop:6}]} onPress={enableNotifications}>{permission==='허용됨'?'알림 권한 다시 확인 →':'알림 권한 허용하기 →'}</Text>
  </Card>
 </Page>;
}
