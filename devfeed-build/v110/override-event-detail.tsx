import { useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Text, View } from 'react-native';
import * as Calendar from 'expo-calendar';
import { Badge, Button, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';
import { useEvent, useSetEventStatus } from '@/api/hooks';
import { colors } from '@/theme';

function detailsFor(summary:string|null, sourceUrl:string){
  return [summary ?? '', '', 'DevFeed에서 추가한 일정', sourceUrl].filter(Boolean).join('\n');
}

async function addEventCalendar(e:any){
  if(!e.startDate){ Alert.alert('일정 확인 필요','행사 날짜가 확인된 뒤 캘린더에 추가할 수 있어요.'); return; }
  const start=new Date(e.startDate);
  const end=e.endDate?new Date(e.endDate):new Date(start.getTime()+2*60*60*1000);
  await Calendar.createEventInCalendarAsync({
    title:e.title,
    startDate:start,
    endDate:end,
    location:e.isOnline?'온라인':(e.location??''),
    notes:detailsFor(e.summary,e.sourceUrl),
  });
}

async function addDeadlineCalendar(e:any){
  if(!e.deadline){ Alert.alert('마감 확인 필요','공식 신청 마감이 확인된 행사만 마감 일정을 추가할 수 있어요.'); return; }
  const start=new Date(e.deadline);
  const end=new Date(start.getTime()+30*60*1000);
  await Calendar.createEventInCalendarAsync({
    title:`[신청 마감] ${e.title}`,
    startDate:start,
    endDate:end,
    location:e.isOnline?'온라인':(e.location??''),
    notes:detailsFor(e.summary,e.sourceUrl),
  });
}

export default function EventDetail(){
 const {id}=useLocalSearchParams<{id:string}>(); const q=useEvent(id); const m=useSetEventStatus(id);
 if(q.isLoading)return <Page><Loading/></Page>;
 if(q.error||!q.data)return <Page><ErrorBox message={q.error?.message??'행사를 찾을 수 없습니다.'}/></Page>;
 const e=q.data;
 const planning=async()=>{
   try{
     await m.mutateAsync('PLANNING');
     Alert.alert('참가 예정으로 저장했어요','휴대폰 캘린더에도 추가할까요?',[
       {text:'나중에',style:'cancel'},
       {text:'행사 일정',onPress:()=>void addEventCalendar(e)},
       {text:e.deadline?'행사 + 마감':'캘린더 추가',onPress:()=>void (async()=>{await addEventCalendar(e); if(e.deadline) await addDeadlineCalendar(e);})()},
     ]);
   }catch(err){Alert.alert('저장 실패',err instanceof Error?err.message:'다시 시도해주세요.');}
 };
 return <Page>
  <Text style={{color:colors.text,fontSize:28,fontWeight:'900'}}>{e.title}</Text>
  <View style={ui.row}>{e.categories.map(c=><Badge key={c}>{c}</Badge>)}</View>
  <Card>
   <Text style={ui.body}>📅 {e.startDate?new Date(e.startDate).toLocaleString('ko-KR'):'일정 확인 필요'}</Text>
   <Text style={ui.body}>📍 {e.isOnline?'온라인':e.location??'장소 확인 필요'}</Text>
   <Text style={ui.body}>⏰ {e.deadline?`신청 마감 ${new Date(e.deadline).toLocaleString('ko-KR')}`:'신청 마감 정보 없음'}</Text>
   <Text style={ui.body}>💰 {e.fee===0?'무료':e.fee==null?'참가비 확인 필요':`${e.fee.toLocaleString()}원`}</Text>
   <Text style={ui.body}>🎓 {e.highSchoolAllowed===true?'고등학생 참가 가능':e.highSchoolAllowed===false?'고등학생 참가 불가':'고등학생 참가 여부 확인 필요'}</Text>
  </Card>
  {e.summary&&<Card><Text style={ui.h2}>행사 소개</Text><Text style={ui.body}>{e.summary}</Text></Card>}
  <Button label="공식 홈페이지" variant="ghost" onPress={()=>Linking.openURL(e.sourceUrl)}/>
  <View style={{gap:8}}>
   <Button label="☆ 관심있음" variant="ghost" onPress={()=>m.mutate('INTERESTED')}/>
   <Button label="참가할래" onPress={planning}/>
   <Button label="신청 완료" variant="ghost" onPress={()=>m.mutate('APPLIED')}/>
  </View>
  <Card>
   <Text style={ui.h2}>캘린더</Text>
   <Text style={ui.muted}>DevFeed가 일정 내용을 채운 뒤 휴대폰의 캘린더 작성 화면을 엽니다. 저장할 Google 계정은 직접 선택할 수 있어요.</Text>
   <View style={{gap:8,paddingTop:8}}>
    <Button label="행사 일정 추가" variant="ghost" onPress={()=>void addEventCalendar(e)}/>
    {e.deadline&&<Button label="신청 마감 추가" variant="ghost" onPress={()=>void addDeadlineCalendar(e)}/>} 
   </View>
  </Card>
 </Page>;
}
