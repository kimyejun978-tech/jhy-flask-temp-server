import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Header, Loading, Page, ui } from '@/components/Ui';
import { useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors } from '@/theme';
import { conflictsWithEvent, hasCalendarPermission, loadDeviceCalendarEvents, type DeviceCalendarEvent } from '@/calendar';

const DAY_MS = 86400000;
const weekday = ['월','화','수','목','금','토','일'];

function dayKey(value: Date | string){ const d=new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthStart(d:Date){ return new Date(d.getFullYear(),d.getMonth(),1); }
function monthEnd(d:Date){ return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999); }
function calendarGrid(month:Date){ const first=monthStart(month); const mondayOffset=(first.getDay()+6)%7; const start=new Date(first.getTime()-mondayOffset*DAY_MS); return Array.from({length:42},(_,i)=>new Date(start.getTime()+i*DAY_MS)); }
function formatTime(value:string,allDay=false){ if(allDay)return '하루 종일'; const d=new Date(value); return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}); }
function eventEnd(e:EventItem){ if(!e.startDate)return null; return e.endDate?new Date(e.endDate):new Date(new Date(e.startDate).getTime()+2*60*60*1000); }

export default function CalendarScreen(){
 const schedule=useSchedule();
 const [month,setMonth]=useState(()=>monthStart(new Date()));
 const [selected,setSelected]=useState(()=>dayKey(new Date()));
 const [deviceEvents,setDeviceEvents]=useState<DeviceCalendarEvent[]>([]);
 const [permission,setPermission]=useState<'checking'|'granted'|'denied'>('checking');
 const [loading,setLoading]=useState(false);
 const grid=useMemo(()=>calendarGrid(month),[month]);
 const devfeed=(schedule.data?.items??[]).filter(e=>e.startDate);

 const load=async(request=false)=>{ setLoading(true); try{ const granted=await hasCalendarPermission(request); setPermission(granted?'granted':'denied'); if(granted){ const start=new Date(monthStart(month).getTime()-7*DAY_MS); const end=new Date(monthEnd(month).getTime()+7*DAY_MS); setDeviceEvents(await loadDeviceCalendarEvents(start,end,false)); } else setDeviceEvents([]); } finally{setLoading(false);} };
 useEffect(()=>{void load(false)},[month]);

 const devfeedByDay=new Map<string,EventItem[]>(); for(const e of devfeed){const k=dayKey(e.startDate!); devfeedByDay.set(k,[...(devfeedByDay.get(k)??[]),e]);}
 const deviceByDay=new Map<string,DeviceCalendarEvent[]>(); for(const e of deviceEvents){const k=dayKey(e.startDate); deviceByDay.set(k,[...(deviceByDay.get(k)??[]),e]);}
 const dayDev=devfeedByDay.get(selected)??[]; const dayDevice=deviceByDay.get(selected)??[];
 const conflictMap=new Map<string,number>(); for(const e of dayDev){ const mins=conflictsWithEvent(e,deviceEvents).reduce((sum,x)=>sum+x.minutes,0); if(mins>0)conflictMap.set(e.id,mins); }
 const selectedDate=new Date(`${selected}T12:00:00`);

 return <Page>
  <Header title="내 캘린더" right={<Pressable onPress={()=>router.back()}><Text style={{color:colors.accent,fontWeight:'900'}}>닫기</Text></Pressable>} />
  <Card>
   <Text style={ui.h2}>DevFeed + 내 휴대폰 일정</Text>
   <Text style={ui.muted}>Google Calendar를 포함해 휴대폰에 동기화된 캘린더를 읽고, DevFeed 참가 일정과 겹치는 시간을 폰 안에서만 계산합니다.</Text>
   {permission==='denied'&&<Button label="캘린더 접근 허용" onPress={()=>void load(true)}/>} 
   {permission==='granted'&&<Text style={{color:colors.green,fontWeight:'800'}}>✓ 캘린더 연결됨 · 서버로 일정 내용을 보내지 않음</Text>}
  </Card>

  <Card>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
    <Pressable onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><Text style={ui.h2}>‹</Text></Pressable>
    <Text style={ui.h2}>{month.getFullYear()}년 {month.getMonth()+1}월</Text>
    <Pressable onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><Text style={ui.h2}>›</Text></Pressable>
   </View>
   <View style={{flexDirection:'row'}}>{weekday.map(x=><Text key={x} style={{flex:1,textAlign:'center',color:colors.muted,fontSize:12,fontWeight:'800'}}>{x}</Text>)}</View>
   <View style={{flexDirection:'row',flexWrap:'wrap'}}>{grid.map((d)=>{const k=dayKey(d);const inMonth=d.getMonth()===month.getMonth();const active=k===selected;const dc=devfeedByDay.get(k)?.length??0;const gc=deviceByDay.get(k)?.length??0;return <Pressable key={k} onPress={()=>setSelected(k)} style={{width:'14.2857%',paddingVertical:7,alignItems:'center',opacity:inMonth?1:.35}}><View style={{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:active?colors.text:'transparent'}}><Text style={{color:active?colors.bg:colors.text,fontWeight:'800'}}>{d.getDate()}</Text></View><View style={{height:8,flexDirection:'row',gap:2,alignItems:'center'}}>{dc>0&&<View style={{width:5,height:5,borderRadius:3,backgroundColor:colors.accent}}/>}{gc>0&&<View style={{width:5,height:5,borderRadius:3,backgroundColor:colors.green}}/>}</View></Pressable>})}</View>
   <View style={ui.row}><Badge>● DevFeed</Badge><Badge>● 기기 캘린더</Badge></View>
  </Card>

  <Text style={ui.h2}>{selectedDate.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})}</Text>
  {(schedule.isLoading||loading)&&<Loading/>}
  {dayDev.length===0&&dayDevice.length===0&&!loading&&<Card><Text style={ui.muted}>이 날은 표시할 일정이 없습니다.</Text></Card>}
  {dayDev.map(e=>{const mins=conflictMap.get(e.id)??0;return <Card key={`d-${e.id}`} onPress={()=>router.push(`/event/${e.id}`)}><View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={[ui.h2,{flex:1}]}>{e.title}</Text><Badge>DevFeed</Badge></View><Text style={ui.muted}>{e.startDate?formatTime(e.startDate):''}{eventEnd(e)?` ~ ${formatTime(eventEnd(e)!.toISOString())}`:''} · {e.isOnline?'온라인':e.location??'장소 미정'}</Text>{mins>0&&<Text style={{color:colors.red,fontWeight:'900'}}>⚠ 기존 일정과 약 {mins>=60?`${Math.floor(mins/60)}시간 ${mins%60?`${mins%60}분`:''}`:`${mins}분`} 겹쳐요</Text>}</Card>})}
  {dayDevice.map(e=><Card key={`g-${e.id}`}><View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={[ui.h2,{flex:1}]}>{e.title}</Text><Badge>{e.calendarTitle}</Badge></View><Text style={ui.muted}>{formatTime(e.startDate,e.allDay)}{!e.allDay?` ~ ${formatTime(e.endDate)}`:''}</Text></Card>)}
 </Page>;
}
