import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Header, Loading, Page, ui } from '@/components/Ui';
import { useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors } from '@/theme';
import { conflictsWithEvent, hasCalendarPermission, loadDeviceCalendarSnapshot, type DeviceCalendarEvent } from '@/calendar';

const weekday=['월','화','수','목','금','토','일'];

function dayKey(value:Date|string){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthStart(d:Date){return new Date(d.getFullYear(),d.getMonth(),1);}
function monthEnd(d:Date){return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999);}
function shiftDay(d:Date,days:number){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+days,12,0,0,0);}
function calendarGrid(month:Date){const first=monthStart(month);const offset=(first.getDay()+6)%7;const start=shiftDay(first,-offset);return Array.from({length:42},(_,i)=>shiftDay(start,i));}
function formatTime(value:string,allDay=false){if(allDay)return '하루 종일';const d=new Date(value);return Number.isNaN(d.getTime())?'시간 확인 필요':d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});}
function eventEnd(e:EventItem){if(!e.startDate)return null;const s=new Date(e.startDate);if(Number.isNaN(s.getTime()))return null;const end=e.endDate?new Date(e.endDate):new Date(s.getTime()+2*60*60*1000);return Number.isNaN(end.getTime())?new Date(s.getTime()+2*60*60*1000):end;}
function keysForRange(startValue:string,endValue:string,allDay=false){
  const start=new Date(startValue);const rawEnd=new Date(endValue);
  if(Number.isNaN(start.getTime())||Number.isNaN(rawEnd.getTime()))return [];
  const end=allDay&&rawEnd>start?new Date(rawEnd.getTime()-1):rawEnd;
  const out:string[]=[];let cur=new Date(start.getFullYear(),start.getMonth(),start.getDate(),12);
  const last=new Date(end.getFullYear(),end.getMonth(),end.getDate(),12);
  for(let guard=0;cur<=last&&guard<370;guard++,cur=shiftDay(cur,1)){const k=dayKey(cur);if(k)out.push(k);}
  return out;
}
function addToMap<T>(map:Map<string,T[]>,keys:string[],item:T){for(const k of keys)map.set(k,[...(map.get(k)??[]),item]);}

export default function ScheduleScreen(){
  const schedule=useSchedule();
  const [month,setMonth]=useState(()=>monthStart(new Date()));
  const [selected,setSelected]=useState(()=>dayKey(new Date()));
  const [deviceEvents,setDeviceEvents]=useState<DeviceCalendarEvent[]>([]);
  const [permission,setPermission]=useState<'checking'|'granted'|'denied'>('checking');
  const [loading,setLoading]=useState(false);
  const [calendarCount,setCalendarCount]=useState(0);
  const [failedCount,setFailedCount]=useState(0);
  const [loadError,setLoadError]=useState<string|null>(null);
  const grid=useMemo(()=>calendarGrid(month),[month]);
  const devfeed=(schedule.data?.items??[]).filter(e=>Boolean(e.startDate));

  const load=async(request=false)=>{
    setLoading(true);setLoadError(null);
    try{
      const granted=await hasCalendarPermission(request);
      setPermission(granted?'granted':'denied');
      if(!granted){setDeviceEvents([]);setCalendarCount(0);setFailedCount(0);return;}
      const start=shiftDay(monthStart(month),-7);const end=shiftDay(monthEnd(month),7);
      const snapshot=await loadDeviceCalendarSnapshot(start,end,false);
      setDeviceEvents(snapshot.events);setCalendarCount(snapshot.calendarCount);setFailedCount(snapshot.failedCalendarCount);
    }catch(err){
      setDeviceEvents([]);setCalendarCount(0);setFailedCount(0);
      setLoadError(err instanceof Error?err.message:'기기 캘린더를 읽지 못했습니다.');
    }finally{setLoading(false);}
  };
  useEffect(()=>{void load(false);},[month]);

  const {devfeedByDay,deviceByDay}=useMemo(()=>{
    const d=new Map<string,EventItem[]>();
    const g=new Map<string,DeviceCalendarEvent[]>();
    for(const e of devfeed){if(!e.startDate)continue;const end=eventEnd(e);addToMap(d,keysForRange(e.startDate,end?.toISOString()??e.startDate),e);}
    for(const e of deviceEvents)addToMap(g,keysForRange(e.startDate,e.endDate,e.allDay),e);
    return {devfeedByDay:d,deviceByDay:g};
  },[schedule.data,deviceEvents]);

  const dayDev=devfeedByDay.get(selected)??[];const dayDevice=deviceByDay.get(selected)??[];
  const conflictMap=new Map<string,number>();
  for(const e of dayDev){const mins=conflictsWithEvent(e,deviceEvents).reduce((sum,x)=>sum+x.minutes,0);if(mins>0)conflictMap.set(e.id,mins);}
  const selectedDate=new Date(`${selected}T12:00:00`);

  return <Page>
    <Header title="일정" right={<Pressable onPress={()=>router.push('/settings')}><Text style={{fontSize:22}}>⚙️</Text></Pressable>} />
    <Card>
      <Text style={ui.h2}>DevFeed + 휴대폰 캘린더</Text>
      <Text style={ui.muted}>휴대폰에 동기화된 Google·Samsung Calendar 일정과 DevFeed 참가 일정을 기기 안에서만 합쳐 봅니다.</Text>
      {permission==='checking'&&<Text style={ui.muted}>캘린더 권한 확인 중…</Text>}
      {permission==='denied'&&<View style={{gap:8}}><Text style={ui.muted}>기기 일정을 같이 보려면 캘린더 접근 권한이 필요합니다. 권한이 없어도 DevFeed 일정은 계속 볼 수 있어요.</Text><Button label="캘린더 접근 허용" onPress={()=>void load(true)}/><Button label="휴대폰 앱 설정 열기" variant="ghost" onPress={()=>void Linking.openSettings()}/></View>}
      {permission==='granted'&&!loadError&&<Text style={{color:colors.green,fontWeight:'800'}}>✓ 연결됨 · 캘린더 {calendarCount}개 · 일정 {deviceEvents.length}개</Text>}
      {failedCount>0&&<Text style={{color:colors.red,fontWeight:'800'}}>⚠ 일부 캘린더 {failedCount}개는 읽지 못해 건너뛰었습니다.</Text>}
      {loadError&&<View style={{gap:8}}><Text style={{color:colors.red,fontWeight:'800'}}>캘린더를 불러오지 못했습니다.</Text><Text style={ui.muted}>다른 일정 화면은 계속 사용할 수 있습니다. 다시 시도해도 안 되면 휴대폰의 캘린더 동기화/권한을 확인해주세요.</Text><Button label="다시 불러오기" variant="ghost" onPress={()=>void load(false)}/></View>}
      {permission==='granted'&&!loadError&&calendarCount===0&&<Text style={ui.muted}>휴대폰에서 사용 가능한 캘린더를 찾지 못했습니다. Google 또는 Samsung Calendar 동기화를 확인해주세요.</Text>}
    </Card>

    <Card>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <Pressable onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><Text style={ui.h2}>‹</Text></Pressable>
        <Pressable onPress={()=>{const now=monthStart(new Date());setMonth(now);setSelected(dayKey(new Date()));}}><Text style={ui.h2}>{month.getFullYear()}년 {month.getMonth()+1}월</Text></Pressable>
        <Pressable onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><Text style={ui.h2}>›</Text></Pressable>
      </View>
      <View style={{flexDirection:'row'}}>{weekday.map(x=><Text key={x} style={{flex:1,textAlign:'center',color:colors.muted,fontSize:12,fontWeight:'800'}}>{x}</Text>)}</View>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>{grid.map(d=>{const k=dayKey(d);const inMonth=d.getMonth()===month.getMonth();const active=k===selected;const dc=devfeedByDay.get(k)?.length??0;const gc=deviceByDay.get(k)?.length??0;return <Pressable key={k} onPress={()=>setSelected(k)} style={{width:'14.2857%',paddingVertical:7,alignItems:'center',opacity:inMonth?1:.35}}><View style={{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:active?colors.text:'transparent'}}><Text style={{color:active?colors.bg:colors.text,fontWeight:'800'}}>{d.getDate()}</Text></View><View style={{height:8,flexDirection:'row',gap:2,alignItems:'center'}}>{dc>0&&<View style={{width:5,height:5,borderRadius:3,backgroundColor:colors.accent}}/>}{gc>0&&<View style={{width:5,height:5,borderRadius:3,backgroundColor:colors.green}}/>}</View></Pressable>})}</View>
      <View style={ui.row}><Badge>● DevFeed</Badge><Badge>● 기기 캘린더</Badge><Pressable onPress={()=>void load(false)}><Badge>↻ 새로고침</Badge></Pressable></View>
    </Card>

    <Text style={ui.h2}>{Number.isNaN(selectedDate.getTime())?selected:selectedDate.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})}</Text>
    {(schedule.isLoading||loading)&&<Loading/>}
    {schedule.error&&<Card><Text style={{color:colors.red,fontWeight:'800'}}>DevFeed 참가 일정을 불러오지 못했습니다.</Text><Text style={ui.muted}>기기 캘린더 일정은 계속 표시합니다.</Text></Card>}
    {dayDev.length===0&&dayDevice.length===0&&!loading&&<Card><Text style={ui.muted}>이 날은 표시할 일정이 없습니다.</Text></Card>}
    {dayDev.map(e=>{const mins=conflictMap.get(e.id)??0;return <Card key={`d-${e.id}`} onPress={()=>router.push(`/event/${e.id}`)}><View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={[ui.h2,{flex:1}]}>{e.title}</Text><Badge>DevFeed</Badge></View><Text style={ui.muted}>{e.startDate?formatTime(e.startDate):''}{eventEnd(e)?` ~ ${formatTime(eventEnd(e)!.toISOString())}`:''} · {e.isOnline?'온라인':e.location??'장소 미정'}</Text>{mins>0&&<Text style={{color:colors.red,fontWeight:'900'}}>⚠ 기존 일정과 약 {mins>=60?`${Math.floor(mins/60)}시간${mins%60?` ${mins%60}분`:''}`:`${mins}분`} 겹쳐요</Text>}</Card>})}
    {dayDevice.map(e=><Card key={`g-${e.id}`}><View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={[ui.h2,{flex:1}]}>{e.title}</Text><Badge>{e.calendarTitle}</Badge></View><Text style={ui.muted}>{formatTime(e.startDate,e.allDay)}{!e.allDay?` ~ ${formatTime(e.endDate)}`:''}</Text></Card>)}
  </Page>;
}
