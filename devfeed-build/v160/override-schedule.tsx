import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Badge, Button, Card, Page, SectionTitle } from '@/components/Ui';
import { useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors, radius } from '@/theme';
import {
  approximateMatchesMonth,
  eventPrecision,
  getEventTiming,
  hasCalendarPermission,
  isLikelySameEvent,
  loadDeviceCalendarSnapshot,
  type DeviceCalendarEvent,
} from '@/calendar';

const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
function noon(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0); }
function shiftDay(d: Date, n: number) { return noon(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }
function weekStart(d: Date) { const x = noon(d); return shiftDay(x, -((x.getDay() + 6) % 7)); }
function monthGridStart(d: Date) { const first = noon(new Date(d.getFullYear(), d.getMonth(), 1)); return shiftDay(first, -((first.getDay() + 6) % 7)); }
function dayKey(d: Date | string) { const x = d instanceof Date ? d : new Date(d); if (Number.isNaN(x.getTime())) return ''; return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
function onDay(startValue: string, endValue: string, day: Date, allDay = false) { const start = new Date(startValue), rawEnd = new Date(endValue); if (Number.isNaN(start.getTime()) || Number.isNaN(rawEnd.getTime())) return false; const end = allDay && rawEnd > start ? new Date(rawEnd.getTime() - 1) : rawEnd; const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0), de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999); return start <= de && end >= ds; }
function timeText(value: string, allDay = false) { if (allDay) return 'ALL'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function durationText(start: string, end: string, allDay = false) { if (allDay) return '하루 종일'; const a = new Date(start), b = new Date(end); const min = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000)); return min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`; }

type TimelineItem = { id: string; title: string; start: string; end: string; allDay: boolean; kind: 'devfeed' | 'device'; subtitle: string; event?: EventItem; device?: DeviceCalendarEvent };

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const schedule = useSchedule();
  const today = useMemo(() => noon(new Date()), []);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [deviceEvents, setDeviceEvents] = useState<DeviceCalendarEvent[]>([]);
  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const allDev = schedule.data?.items ?? [];
  const exactDev = useMemo(() => allDev.filter(e => eventPrecision(e) === 'EXACT' && Boolean(e.startDate)), [allDev]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDay(weekStart(cursor), i)), [cursor]);
  const monthDays = useMemo(() => Array.from({ length: 42 }, (_, i) => shiftDay(monthGridStart(cursor), i)), [cursor]);
  const loadRange = useMemo(() => viewMode === 'month' ? { start: shiftDay(monthGridStart(cursor), -1), end: shiftDay(monthGridStart(cursor), 43) } : { start: shiftDay(weekStart(cursor), -7), end: shiftDay(weekStart(cursor), 14) }, [cursor, viewMode]);

  const load = useCallback(async (request = false) => {
    setLoading(true); setLoadError('');
    try {
      const granted = await hasCalendarPermission(request); setPermission(granted ? 'granted' : 'denied');
      if (!granted) { setDeviceEvents([]); return; }
      const snap = await loadDeviceCalendarSnapshot(loadRange.start, loadRange.end, false); setDeviceEvents(snap.events);
    } catch (e) { setDeviceEvents([]); setLoadError(e instanceof Error ? e.message : '캘린더를 읽지 못했습니다.'); }
    finally { setLoading(false); }
  }, [loadRange.end, loadRange.start]);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const visibleDevice = useMemo(() => deviceEvents.filter(x => !allDev.some(e => isLikelySameEvent(e, x))), [deviceEvents, allDev]);
  const selectedItems = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    for (const e of exactDev) { const t = getEventTiming(e); if (!t || !onDay(t.start.toISOString(), t.end.toISOString(), selected, t.allDayLike)) continue; out.push({ id: `d-${e.id}`, title: e.title, start: t.start.toISOString(), end: t.end.toISOString(), allDay: t.allDayLike, kind: 'devfeed', subtitle: e.isOnline ? '온라인' : e.location ?? '장소 미정', event: e }); }
    for (const x of visibleDevice) { if (!onDay(x.startDate, x.endDate, selected, x.allDay)) continue; out.push({ id: `g-${x.id}`, title: x.title, start: x.startDate, end: x.endDate, allDay: x.allDay, kind: 'device', subtitle: x.calendarTitle, device: x }); }
    return out.sort((a, b) => a.allDay === b.allDay ? new Date(a.start).getTime() - new Date(b.start).getTime() : a.allDay ? -1 : 1);
  }, [exactDev, visibleDevice, selected]);

  const marks = useMemo(() => {
    const map = new Map<string, { devfeed: boolean; device: boolean }>();
    const put = (key: string, kind: 'devfeed' | 'device') => { const v = map.get(key) ?? { devfeed: false, device: false }; v[kind] = true; map.set(key, v); };
    for (const e of exactDev) { const t = getEventTiming(e); if (!t) continue; for (const d of monthDays) if (onDay(t.start.toISOString(), t.end.toISOString(), d, t.allDayLike)) put(dayKey(d), 'devfeed'); }
    for (const x of visibleDevice) for (const d of monthDays) if (onDay(x.startDate, x.endDate, d, x.allDay)) put(dayKey(d), 'device');
    return map;
  }, [exactDev, visibleDevice, monthDays]);

  const approximate = allDev.filter(e => approximateMatchesMonth(e, selected));
  const selectedLabel = selected.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  const movePeriod = (delta: number) => { const next = viewMode === 'month' ? noon(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)) : shiftDay(cursor, delta * 7); setCursor(next); setSelected(next); };
  const selectDate = (d: Date) => { setSelected(d); if (viewMode === 'week' || d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) setCursor(d); };
  const openItem = (item: TimelineItem) => {
    if (item.event) { router.push(`/event/${item.event.id}`); return; }
    if (item.device) router.push(`/calendar-edit?eventId=${encodeURIComponent(item.device.eventId)}`);
  };

  return <Page>
    <View style={styles.top}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.eyebrow}>FOCUS CALENDAR</Text><Text style={[styles.title, compact && { fontSize: 28 }]}>내 일정</Text><Text style={styles.subtitle}>한 달을 보고, 휴대폰 일정은 눌러서 바로 수정하거나 삭제할 수 있어요.</Text></View><Pressable onPress={() => router.push('/calendar-add')} style={styles.addButton}><Text style={styles.addButtonText}>＋</Text></Pressable></View>

    <View style={styles.viewSwitch}><Pressable onPress={() => { setViewMode('month'); setCursor(selected); }} style={[styles.viewOption, viewMode === 'month' && styles.viewOptionActive]}><Text style={[styles.viewOptionText, viewMode === 'month' && styles.viewOptionTextActive]}>월간</Text></Pressable><Pressable onPress={() => { setViewMode('week'); setCursor(selected); }} style={[styles.viewOption, viewMode === 'week' && styles.viewOptionActive]}><Text style={[styles.viewOptionText, viewMode === 'week' && styles.viewOptionTextActive]}>주간</Text></Pressable></View>

    <View style={styles.controlRow}><Pressable onPress={() => movePeriod(-1)} style={styles.navButton}><Text style={styles.navText}>‹</Text></Pressable><Pressable onPress={() => { setCursor(today); setSelected(today); }} style={styles.monthButton}><Text style={styles.monthText}>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</Text><Text style={styles.todayHint}>오늘로 이동</Text></Pressable><Pressable onPress={() => movePeriod(1)} style={styles.navButton}><Text style={styles.navText}>›</Text></Pressable></View>

    {viewMode === 'month' ? <View style={styles.monthCard}>
      <View style={styles.weekHeader}>{WEEK.map((label, i) => <View key={label} style={styles.weekHeaderCell}><Text style={[styles.weekHeaderText, i >= 5 && { color: colors.muted }]}>{label}</Text></View>)}</View>
      <View style={styles.monthGrid}>{monthDays.map(d => { const key = dayKey(d), active = key === dayKey(selected), inMonth = d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear(), m = marks.get(key); return <Pressable key={key} onPress={() => selectDate(d)} style={styles.monthCell}><View style={[styles.dateBubble, compact && { width: 38, height: 43 }, active && styles.dateBubbleActive]}><Text style={[styles.monthDate, !inMonth && { color: '#C8C5CE' }, active && { color: '#fff' }]}>{d.getDate()}</Text><View style={styles.markRow}>{m?.devfeed ? <View style={[styles.markDot, { backgroundColor: active ? '#fff' : colors.accent }]} /> : null}{m?.device ? <View style={[styles.markDot, { backgroundColor: active ? '#FFD5B7' : colors.orange }]} /> : null}</View></View></Pressable>; })}</View>
      <View style={styles.legendRow}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.accent }]} /><Text style={styles.legendText}>DevFeed</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.orange }]} /><Text style={styles.legendText}>휴대폰 일정</Text></View></View>
    </View> : <View style={styles.weekStrip}>{week.map((d, i) => { const active = dayKey(d) === dayKey(selected); return <Pressable key={dayKey(d)} onPress={() => selectDate(d)} style={[styles.dayCell, active && styles.dayCellActive]}><Text style={[styles.weekday, active && { color: '#E7DDFF' }]}>{WEEK[i]}</Text><Text style={[styles.dayNumber, active && { color: '#fff' }]}>{d.getDate()}</Text></Pressable>; })}</View>}

    <SectionTitle title={selectedLabel} subtitle="시간순 하루 타임라인" right={<Pressable onPress={() => void load(true)}><Text style={styles.refresh}>↻</Text></Pressable>} />
    {permission === 'denied' ? <Card><Text style={styles.cardTitle}>캘린더 권한이 필요해요.</Text><Text style={styles.muted}>휴대폰 일정 읽기·수정·삭제를 위해 권한을 허용해주세요.</Text><Button label="권한 요청" onPress={() => void load(true)} /><Button label="휴대폰 설정 열기" variant="ghost" onPress={() => void Linking.openSettings()} /></Card> : null}
    {loadError ? <Card><Text style={styles.error}>{loadError}</Text></Card> : null}
    {loading ? <Text style={styles.muted}>휴대폰 캘린더 동기화 중…</Text> : null}

    {selectedItems.length ? <View style={styles.timeline}>{selectedItems.map(item => <Pressable key={item.id} onPress={() => openItem(item)} style={styles.timelineRow}><View style={styles.timeCol}><Text style={styles.time}>{timeText(item.start, item.allDay)}</Text><Text style={styles.duration}>{durationText(item.start, item.end, item.allDay)}</Text></View><View style={[styles.eventBlock, item.kind === 'device' ? styles.deviceBlock : styles.devfeedBlock]}><View style={styles.blockTop}><Badge tone={item.kind === 'device' ? 'orange' : 'purple'}>{item.kind === 'device' ? '휴대폰' : 'DevFeed'}</Badge><Text style={styles.editHint}>{item.kind === 'device' ? '수정 ›' : '상세 ›'}</Text></View><Text style={styles.eventTitle}>{item.title}</Text><Text style={styles.eventMeta}>{item.subtitle}</Text></View></Pressable>)}</View> : <Card><Text style={styles.cardTitle}>이 날은 비어 있어요.</Text><Text style={styles.muted}>새 일정을 추가하거나 다른 날짜를 선택해보세요.</Text><Button label="+ 일정 추가" onPress={() => router.push('/calendar-add')} /></Card>}

    {approximate.length ? <><SectionTitle title="날짜 미정 DevFeed 일정" subtitle="정확한 날짜가 공개되면 달력에 배치됩니다." /><Card>{approximate.slice(0, 4).map(e => <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={styles.approxRow}><Text style={styles.approxTitle}>{e.title}</Text><Text style={styles.approxArrow}>›</Text></Pressable>)}</Card></> : null}
  </Page>;
}

const styles = StyleSheet.create({
  top:{flexDirection:'row',gap:12,alignItems:'flex-start'},eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.8},title:{color:colors.text,fontSize:32,lineHeight:38,fontWeight:'900',letterSpacing:-1},subtitle:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:6},addButton:{width:50,height:50,borderRadius:18,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},addButtonText:{color:'#fff',fontSize:29,lineHeight:32,fontWeight:'500'},viewSwitch:{flexDirection:'row',backgroundColor:'#ECEAF2',borderRadius:18,padding:4,gap:4},viewOption:{flex:1,minHeight:44,borderRadius:14,alignItems:'center',justifyContent:'center'},viewOptionActive:{backgroundColor:'#fff'},viewOptionText:{color:colors.muted,fontSize:13,fontWeight:'800'},viewOptionTextActive:{color:colors.accentDark},controlRow:{flexDirection:'row',gap:10},navButton:{width:54,height:54,borderRadius:18,borderWidth:1,borderColor:colors.line,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},navText:{color:colors.text,fontSize:30},monthButton:{flex:1,height:54,borderRadius:18,borderWidth:1,borderColor:colors.line,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},monthText:{color:colors.text,fontSize:16,fontWeight:'900'},todayHint:{color:colors.muted,fontSize:9,fontWeight:'700',marginTop:2},monthCard:{backgroundColor:'#fff',borderRadius:24,borderWidth:1,borderColor:colors.line,padding:10},weekHeader:{flexDirection:'row'},weekHeaderCell:{flex:1,alignItems:'center',paddingVertical:8},weekHeaderText:{color:colors.muted,fontSize:10,fontWeight:'900'},monthGrid:{flexDirection:'row',flexWrap:'wrap'},monthCell:{width:'14.2857%',alignItems:'center',paddingVertical:3},dateBubble:{width:42,height:46,borderRadius:15,alignItems:'center',justifyContent:'center'},dateBubbleActive:{backgroundColor:colors.accent},monthDate:{color:colors.text,fontSize:14,fontWeight:'900'},markRow:{height:7,flexDirection:'row',gap:3,marginTop:3},markDot:{width:4,height:4,borderRadius:2},legendRow:{flexDirection:'row',justifyContent:'center',gap:16,paddingTop:9},legendItem:{flexDirection:'row',alignItems:'center',gap:5},legendDot:{width:7,height:7,borderRadius:4},legendText:{color:colors.muted,fontSize:10,fontWeight:'700'},weekStrip:{flexDirection:'row',gap:5,backgroundColor:'#fff',borderRadius:22,borderWidth:1,borderColor:colors.line,padding:9},dayCell:{flex:1,minHeight:68,borderRadius:16,alignItems:'center',justifyContent:'center'},dayCellActive:{backgroundColor:colors.accent},weekday:{color:colors.muted,fontSize:10,fontWeight:'900'},dayNumber:{color:colors.text,fontSize:19,fontWeight:'900',marginTop:4},refresh:{color:colors.accent,fontSize:23,fontWeight:'900'},timeline:{backgroundColor:'#fff',borderRadius:24,borderWidth:1,borderColor:colors.line,overflow:'hidden'},timelineRow:{flexDirection:'row',gap:10,padding:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},timeCol:{width:62,paddingTop:7},time:{color:colors.text,fontSize:13,fontWeight:'900'},duration:{color:colors.muted,fontSize:9,marginTop:3},eventBlock:{flex:1,minWidth:0,borderRadius:17,padding:13,borderWidth:1},deviceBlock:{backgroundColor:'#FFF4EC',borderColor:'#F4DCCB'},devfeedBlock:{backgroundColor:'#F1EDFF',borderColor:'#E2D9FF'},blockTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},editHint:{color:colors.muted,fontSize:10,fontWeight:'800'},eventTitle:{color:colors.text,fontSize:16,lineHeight:22,fontWeight:'900',marginTop:8},eventMeta:{color:colors.muted,fontSize:11,marginTop:5},cardTitle:{color:colors.text,fontSize:17,fontWeight:'900'},muted:{color:colors.muted,fontSize:12,lineHeight:19},error:{color:colors.red,fontSize:12,lineHeight:18,fontWeight:'700'},approxRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},approxTitle:{flex:1,color:colors.text,fontSize:13,fontWeight:'800'},approxArrow:{color:colors.muted,fontSize:20}
});
