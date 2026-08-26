import { useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Text, View } from 'react-native';
import { Badge, Button, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';
import { useEvent, useSetEventStatus } from '@/api/hooks';
import { colors } from '@/theme';
import type { EventStatus } from '@/types';

function googleCalendarUrl(title:string,start:string|null,end:string|null,details:string,location:string|null){
 const fmt=(s:string)=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const startIso=start?fmt(start):fmt(new Date().toISOString()); const endIso=end?fmt(end):fmt(new Date((start?new Date(start):new Date()).getTime()+3600000).toISOString());
 const p=new URLSearchParams({action:'TEMPLATE',text:title,dates:`${startIso}/${endIso}`,details,location:location??''}); return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export default function EventDetail(){
 const {id}=useLocalSearchParams<{id:string}>();
 const q=useEvent(id);
 const m=useSetEventStatus(id);
 if(q.isLoading)return <Page><Loading/></Page>;
 if(q.error||!q.data)return <Page><ErrorBox message={q.error?.message??'행사를 찾을 수 없습니다.'}/></Page>;
 const e=q.data;
 const setStatus=(status:EventStatus)=>m.mutate(status);
 const toggleInterested=()=>setStatus(e.userStatus==='INTERESTED'?'NONE':'INTERESTED');
 const planning=async()=>{
   await m.mutateAsync('PLANNING');
   if(e.startDate){
     Alert.alert('참가 일정 등록','Google Calendar에도 추가할까요?',[{text:'나중에'},{text:'추가',onPress:()=>Linking.openURL(googleCalendarUrl(e.title,e.startDate,e.endDate,e.summary??'',e.location))}]);
   }
 };
 return <Page>
   <Text style={{color:colors.text,fontSize:28,fontWeight:'900'}}>{e.title}</Text>
   <View style={ui.row}>{e.categories.map(c=><Badge key={c}>{c}</Badge>)}</View>
   <Card>
     <Text style={ui.body}>📅 {e.startDate?new Date(e.startDate).toLocaleString('ko-KR'):'일정 확인 필요'}</Text>
     <Text style={ui.body}>📍 {e.isOnline?'온라인':e.location??'장소 확인 필요'}</Text>
     {e.deadline?<Text style={ui.body}>⏰ 신청 마감 {new Date(e.deadline).toLocaleString('ko-KR')}</Text>:null}
     <Text style={ui.body}>💰 {e.fee===0?'무료':e.fee==null?'참가비 확인 필요':`${e.fee.toLocaleString()}원`}</Text>
     <Text style={ui.body}>🎓 {e.highSchoolAllowed===true?'고등학생 참가 가능':e.highSchoolAllowed===false?'고등학생 참가 불가':'고등학생 참가 여부 확인 필요'}</Text>
   </Card>
   {e.summary&&<Card><Text style={ui.h2}>행사 소개</Text><Text style={ui.body}>{e.summary}</Text></Card>}
   <Button label="공식 홈페이지" variant="ghost" onPress={()=>Linking.openURL(e.sourceUrl)}/>
   <View style={{gap:8}}>
     <Button label={e.userStatus==='INTERESTED'?'★ 관심있음':'☆ 관심있음'} variant="ghost" onPress={toggleInterested}/>
     <Button label={e.userStatus==='PLANNING'?'✓ 참가 예정':'참가할래'} onPress={planning}/>
     <Button label={e.userStatus==='APPLIED'?'✓ 신청 완료':'신청 완료'} variant="ghost" onPress={()=>setStatus(e.userStatus==='APPLIED'?'NONE':'APPLIED')}/>
   </View>
   {m.isError?<Text style={{color:colors.red,fontWeight:'700'}}>상태 저장에 실패했어요. 다시 눌러주세요.</Text>:null}
 </Page>
}
