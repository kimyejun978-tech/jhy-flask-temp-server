import * as Calendar from 'expo-calendar';
import type { EventItem } from './types';

export type DeviceCalendarEvent={
  id:string;
  title:string;
  startDate:string;
  endDate:string;
  allDay:boolean;
  calendarId:string;
  calendarTitle:string;
};

export type CalendarSnapshot={
  events:DeviceCalendarEvent[];
  calendarCount:number;
  failedCalendarCount:number;
};

function toIso(value:unknown):string|null{
  try{
    const d=value instanceof Date?value:new Date(String(value));
    return Number.isNaN(d.getTime())?null:d.toISOString();
  }catch{return null;}
}

export async function hasCalendarPermission(requestIfNeeded=false):Promise<boolean>{
  let permission=await Calendar.getCalendarPermissionsAsync();
  if(permission.status!=='granted'&&requestIfNeeded&&permission.canAskAgain!==false){
    permission=await Calendar.requestCalendarPermissionsAsync();
  }
  return permission.status==='granted';
}

export async function loadDeviceCalendarSnapshot(start:Date,end:Date,requestIfNeeded=false):Promise<CalendarSnapshot>{
  const granted=await hasCalendarPermission(requestIfNeeded);
  if(!granted)return {events:[],calendarCount:0,failedCalendarCount:0};

  const calendars=await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const usable=calendars.filter(c=>Boolean(c.id));
  if(!usable.length)return {events:[],calendarCount:0,failedCalendarCount:0};

  const settled=await Promise.allSettled(usable.map(async cal=>{
    const rows=await Calendar.getEventsAsync([cal.id],start,end);
    return rows.map(item=>({item,cal}));
  }));

  const out:DeviceCalendarEvent[]=[];
  let failed=0;
  for(const result of settled){
    if(result.status==='rejected'){failed+=1;continue;}
    for(const {item,cal} of result.value){
      const startDate=toIso(item.startDate);
      const endDate=toIso(item.endDate??item.startDate);
      if(!startDate||!endDate)continue;
      out.push({
        id:`${cal.id}:${item.id}:${startDate}`,
        title:item.title||'제목 없는 일정',
        startDate,
        endDate,
        allDay:Boolean(item.allDay),
        calendarId:cal.id,
        calendarTitle:cal.title||'캘린더',
      });
    }
  }

  const dedup=new Map<string,DeviceCalendarEvent>();
  for(const item of out)dedup.set(item.id,item);
  return {
    events:[...dedup.values()].sort((a,b)=>new Date(a.startDate).getTime()-new Date(b.startDate).getTime()),
    calendarCount:usable.length,
    failedCalendarCount:failed,
  };
}

export async function loadDeviceCalendarEvents(start:Date,end:Date,requestIfNeeded=false):Promise<DeviceCalendarEvent[]>{
  return (await loadDeviceCalendarSnapshot(start,end,requestIfNeeded)).events;
}

function rangeForEvent(event:EventItem){
  if(!event.startDate)return null;
  const start=new Date(event.startDate);
  if(Number.isNaN(start.getTime()))return null;
  const rawEnd=event.endDate?new Date(event.endDate):new Date(start.getTime()+2*60*60*1000);
  const end=Number.isNaN(rawEnd.getTime())?new Date(start.getTime()+2*60*60*1000):rawEnd;
  return {start,end:end>start?end:new Date(start.getTime()+30*60*1000)};
}

export function overlapMinutes(aStart:Date,aEnd:Date,bStart:Date,bEnd:Date):number{
  const start=Math.max(aStart.getTime(),bStart.getTime());
  const end=Math.min(aEnd.getTime(),bEnd.getTime());
  return Math.max(0,Math.round((end-start)/60000));
}

export function conflictsWithEvent(event:EventItem,deviceEvents:DeviceCalendarEvent[]){
  const range=rangeForEvent(event);
  if(!range)return [];
  return deviceEvents.map(item=>({item,minutes:overlapMinutes(range.start,range.end,new Date(item.startDate),new Date(item.endDate))}))
    .filter(x=>x.minutes>0)
    .sort((a,b)=>b.minutes-a.minutes);
}

export async function findConflictsForEvent(event:EventItem,requestIfNeeded=false){
  const range=rangeForEvent(event);
  if(!range)return [];
  const margin=24*60*60*1000;
  const device=await loadDeviceCalendarEvents(new Date(range.start.getTime()-margin),new Date(range.end.getTime()+margin),requestIfNeeded);
  return conflictsWithEvent(event,device);
}

export async function addEventWithSystemForm(event:EventItem){
  if(!event.startDate)throw new Error('행사 날짜가 확인되지 않았습니다.');
  const range=rangeForEvent(event);
  if(!range)throw new Error('행사 날짜 형식을 확인하지 못했습니다.');
  return Calendar.createEventInCalendarAsync({
    title:event.title,
    startDate:range.start,
    endDate:range.end,
    location:event.isOnline?'온라인':(event.location??''),
    notes:[event.summary??'','','DevFeed에서 추가한 일정',event.sourceUrl].filter(Boolean).join('\n'),
  });
}

export async function addDeadlineWithSystemForm(event:EventItem){
  if(!event.deadline)throw new Error('공식 신청 마감이 확인되지 않았습니다.');
  const start=new Date(event.deadline);
  if(Number.isNaN(start.getTime()))throw new Error('신청 마감 날짜 형식을 확인하지 못했습니다.');
  return Calendar.createEventInCalendarAsync({
    title:`[신청 마감] ${event.title}`,
    startDate:start,
    endDate:new Date(start.getTime()+30*60*1000),
    location:event.isOnline?'온라인':(event.location??''),
    notes:[event.summary??'','','DevFeed에서 추가한 신청 마감',event.sourceUrl].filter(Boolean).join('\n'),
  });
}
