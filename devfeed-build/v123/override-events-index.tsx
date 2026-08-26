import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { Badge, Card, ErrorBox, Header, Loading, Page, ui } from '@/components/Ui';
import { useEvents, useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors } from '@/theme';

function dday(deadline:string|null){if(!deadline)return '';const d=Math.ceil((new Date(deadline).getTime()-Date.now())/86400000);return d>=0?`D-${d}`:'마감';}
function meta(e:EventItem){const out=[];if(e.location)out.push(e.location);if(e.isOnline)out.push('온라인');if(e.fee===0)out.push('무료');if(e.highSchoolAllowed===true)out.push('고등학생 가능');return out;}
function EventCard({e}:{e:EventItem}){return <Card onPress={()=>router.push(`/event/${e.id}`)}>
  <View style={{flexDirection:'row',justifyContent:'space-between',gap:10}}><Text style={[ui.h2,{flex:1}]}>{e.title}</Text>{dday(e.deadline)?<Text style={{color:e.importance==='HIGH'?colors.red:colors.muted,fontWeight:'800'}}>{dday(e.deadline)}</Text>:null}</View>
  <View style={ui.row}>{e.categories.slice(0,3).map(c=><Badge key={c}>{c}</Badge>)}</View>
  <Text style={ui.muted}>{meta(e).join(' · ')||'공식 상세에서 확인'}</Text>
  {e.summary?<Text style={ui.body}>{e.summary}</Text>:null}
  {e.userStatus!=='NONE'&&<Text style={{color:colors.green,fontWeight:'800'}}>✓ {e.userStatus==='INTERESTED'?'관심있음':e.userStatus==='PLANNING'?'참가 예정':e.userStatus==='APPLIED'?'신청 완료':'완료'}</Text>}
</Card>}

export default function EventsScreen(){
  const [category,setCategory]=useState('전체');
  const all=useEvents();const schedule=useSchedule();
  const items=(all.data?.items??[]).filter(e=>category==='전체'||e.categories.some(c=>c.toLowerCase().includes(category.toLowerCase())||category.toLowerCase().includes(c.toLowerCase())));
  return <Page>
    <Header title="행사" right={<Pressable onPress={()=>router.push('/settings')}><Text style={{fontSize:22}}>⚙️</Text></Pressable>} />
    <Card onPress={()=>router.push('/schedule')}><Text style={ui.h2}>오늘의 브리핑</Text><Text style={ui.muted}>🔥 추천 행사 {all.data?.items.filter(x=>x.importance==='HIGH').length??0}개 · 🗓 참가 예정 {schedule.data?.items.length??0}개</Text><Text style={[ui.body,{fontWeight:'800',paddingTop:4}]}>내 일정/캘린더 보기 →</Text></Card>
    <View style={ui.row}>{['전체','AI','로봇','임베디드','SW','해커톤'].map(x=><Pressable key={x} onPress={()=>setCategory(x)} style={{opacity:category===x?1:.55}}><Badge>{category===x?`✓ ${x}`:x}</Badge></Pressable>)}</View>
    <Text style={[ui.h2,{marginTop:8}]}>🔥 놓치면 아쉬워요</Text>
    {all.isLoading&&<Loading/>}{all.error&&<ErrorBox message={all.error.message}/>} 
    {items.length===0&&<Card><Text style={ui.muted}>이 필터에 맞는 행사가 아직 없습니다.</Text></Card>}
    {items.map(e=><EventCard key={e.id} e={e}/>)}
  </Page>;
}
