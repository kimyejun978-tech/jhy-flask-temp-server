import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Linking, Text, View } from 'react-native';
import { Badge, Button, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';
import { useEvent, useSetEventStatus } from '@/api/hooks';
import { colors } from '@/theme';
import { addDeadlineWithSystemForm, addEventWithSystemForm, describeEventTiming, eventDateLabel, eventPrecision, findConflictsForEvent, isDateOnlyValue, type EventConflict } from '@/calendar';

function conflictText(conflicts:EventConflict[]){const top=conflicts.slice(0,3).map(x=>x.approximate?`• ${x.item.title} · 같은 기간에 일정 있음`:`• ${x.item.title} · ${x.minutes>=60?`${Math.floor(x.minutes/60)}시간${x.minutes%60?` ${x.minutes%60}분`:''}`:`${x.minutes}분`} 겹침`).join('\n');return `기존 캘린더 일정과 겹칩니다.\n\n${top}${conflicts.length>3?`\n외 ${conflicts.length-3}개`:''}`;}
function deadlineText(value:string){if(isDateOnlyValue(value))return new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('ko-KR');const d=new Date(value);return Number.isNaN(d.getTime())?'마감일 확인 필요':d.toLocaleString('ko-KR');}

export default function EventDetail(){
  const {id}=useLocalSearchParams<{id:string}>();const q=useEvent(id);const m=useSetEventStatus(id);
  if(q.isLoading)return <Page><Loading/></Page>;if(q.error||!q.data)return <Page><ErrorBox message={q.error?.message??'행사를 찾을 수 없습니다.'}/></Page>;const e=q.data;const exact=eventPrecision(e)==='EXACT';
  const calendarAdd=async(kind:'event'|'deadline'|'both')=>{try{if(kind==='event'||kind==='both')await addEventWithSystemForm(e);if((kind==='deadline'||kind==='both')&&e.deadline)await addDeadlineWithSystemForm(e);}catch(err){Alert.alert('캘린더 추가 실패',err instanceof Error?err.message:'캘린더 작성 화면을 열지 못했습니다.');}};
  const afterPlanning=()=>{if(!exact){Alert.alert('참가 예정으로 저장했어요',`${eventDateLabel(e)}으로 안내된 일정이라 정확한 날짜가 공개되기 전까지 자동 충돌 계산과 행사 일정 캘린더 추가는 하지 않습니다.${e.deadline?'\n\n신청 마감은 별도로 캘린더에 추가할 수 있어요.':''}`);return;}Alert.alert('참가 예정으로 저장했어요','휴대폰 캘린더에도 추가할까요?',[{text:'나중에',style:'cancel'},{text:'행사 일정',onPress:()=>void calendarAdd('event')},{text:e.deadline?'행사 + 마감':'캘린더 추가',onPress:()=>void calendarAdd(e.deadline?'both':'event')}]);};
  const savePlanning=async()=>{try{await m.mutateAsync('PLANNING');afterPlanning();}catch(err){Alert.alert('저장 실패',err instanceof Error?err.message:'다시 시도해주세요.')}};
  const planning=async()=>{if(!exact){await savePlanning();return;}try{const conflicts=await findConflictsForEvent(e,true);if(conflicts.length){Alert.alert('⚠ 일정이 겹쳐요',conflictText(conflicts),[{text:'취소',style:'cancel'},{text:'일정 보기',onPress:()=>router.push('/schedule')},{text:'그래도 참가',onPress:()=>void savePlanning()}]);return;}await savePlanning();}catch{Alert.alert('캘린더 확인 실패','기기 캘린더 일부를 읽지 못했습니다. 참가 예정 저장은 계속할 수 있어요.',[{text:'취소',style:'cancel'},{text:'일정 탭 열기',onPress:()=>router.push('/schedule')},{text:'그래도 참가',onPress:()=>void savePlanning()}]);}};
  const check=async()=>{if(!exact){Alert.alert('정확한 날짜 미정',`${eventDateLabel(e)}으로만 안내되어 있어 지금은 일정 충돌을 계산하지 않습니다. 정확한 날짜가 공개되면 자동으로 비교할 수 있어요.`);return;}try{const conflicts=await findConflictsForEvent(e,true);Alert.alert(conflicts.length?'일정 충돌 발견':'겹치는 일정 없음',conflicts.length?conflictText(conflicts):'현재 읽을 수 있는 휴대폰 캘린더 기준으로 겹치는 일정이 없습니다.');}catch{Alert.alert('확인 실패','캘린더 일부를 읽지 못했습니다. 일정 탭에서 권한과 동기화 상태를 확인해주세요.');}};
  return <Page>
    <Text style={{color:colors.text,fontSize:28,fontWeight:'900'}}>{e.title}</Text><View style={ui.row}>{e.categories.map(c=><Badge key={c}>{c}</Badge>)}</View>
    <Card><Text style={ui.body}>📅 {describeEventTiming(e)}</Text><Text style={ui.body}>📍 {e.isOnline?'온라인':e.location??'장소 확인 필요'}</Text>{e.deadline?<Text style={ui.body}>⏰ 신청 마감 {deadlineText(e.deadline)}</Text>:null}<Text style={ui.body}>💰 {e.fee===0?'무료':e.fee==null?'참가비 확인 필요':`${e.fee.toLocaleString()}원`}</Text><Text style={ui.body}>🎓 {e.highSchoolAllowed===true?'고등학생 참가 가능':e.highSchoolAllowed===false?'고등학생 참가 불가':'고등학생 참가 여부 확인 필요'}</Text></Card>
    {e.summary&&<Card><Text style={ui.h2}>행사 소개</Text><Text style={ui.body}>{e.summary}</Text></Card>}
    <Card><Text style={ui.h2}>일정 충돌</Text>{exact?<Text style={ui.muted}>휴대폰에 동기화된 캘린더와 이 행사 시간을 기기 안에서만 비교합니다.</Text>:<Text style={ui.muted}>‘{eventDateLabel(e)}’처럼 정확한 날짜가 없는 일정은 가짜 날짜를 만들지 않고 충돌 계산에서 제외합니다.</Text>}<Button label={exact?'기존 일정과 겹치는지 확인':'정확한 날짜 상태 확인'} variant="ghost" onPress={()=>void check()}/></Card>
    <Button label="공식 홈페이지" variant="ghost" onPress={()=>Linking.openURL(e.sourceUrl)}/><View style={{gap:8}}><Button label="☆ 관심있음" variant="ghost" onPress={()=>m.mutate('INTERESTED')}/><Button label="참가할래" onPress={()=>void planning()}/><Button label="신청 완료" variant="ghost" onPress={()=>m.mutate('APPLIED')}/></View>
    <Card><Text style={ui.h2}>캘린더</Text>{exact?<Text style={ui.muted}>정확한 행사 일정을 휴대폰 캘린더 작성 화면으로 넘깁니다.</Text>:<Text style={ui.muted}>행사 자체는 정확한 날짜가 공개된 뒤 추가할 수 있습니다.</Text>}<View style={{gap:8,paddingTop:8}}>{exact&&<Button label="행사 일정 추가" variant="ghost" onPress={()=>void calendarAdd('event')}/>} {e.deadline&&<Button label="신청 마감 추가" variant="ghost" onPress={()=>void calendarAdd('deadline')}/>}<Button label="일정 탭 보기" variant="ghost" onPress={()=>router.push('/schedule')}/></View></Card>
  </Page>;
}
