import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Loading, Page } from '@/components/Ui';
import { colors } from '@/theme';
import {
  buildManualDraft,
  deleteDeviceCalendarEvent,
  formatInputDate,
  formatInputTime,
  getDeviceCalendarEventDraft,
  updateDeviceCalendarEvent,
} from '@/calendar-create';

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9A98A5" multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function CalendarEditScreen() {
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : '';
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let active = true;
    if (!eventId) { setError('일정 ID가 없습니다.'); setLoading(false); return; }
    void getDeviceCalendarEventDraft(eventId).then(({ draft }) => {
      if (!active) return;
      setTitle(draft.title);
      setDate(formatInputDate(draft.startDate));
      setStartTime(formatInputTime(draft.startDate));
      setEndTime(formatInputTime(draft.endDate));
      setAllDay(draft.allDay);
      setLocation(draft.location ?? '');
      setNotes(draft.notes ?? '');
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  const save = async () => {
    try {
      const draft = buildManualDraft({ title, date, startTime, endTime, allDay, notes, location });
      setBusy(true);
      await updateDeviceCalendarEvent(eventId, draft);
      Alert.alert('수정 완료', '휴대폰 캘린더 일정이 수정됐습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) { Alert.alert('수정 실패', e instanceof Error ? e.message : '일정을 수정하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const remove = () => {
    Alert.alert('일정을 삭제할까요?', '삭제하면 휴대폰 캘린더에서도 사라집니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        setBusy(true);
        void deleteDeviceCalendarEvent(eventId).then(() => {
          Alert.alert('삭제 완료', '일정을 삭제했습니다.', [{ text: '확인', onPress: () => router.back() }]);
        }).catch((e) => Alert.alert('삭제 실패', e instanceof Error ? e.message : '일정을 삭제하지 못했습니다.'))
          .finally(() => setBusy(false));
      } },
    ]);
  };

  if (loading) return <Page><Loading /></Page>;
  if (error) return <Page><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>일정 편집</Text></View><Card><Text style={styles.error}>{error}</Text></Card></Page>;

  return <Page style={{ paddingBottom: 70 }}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>CALENDAR EDIT</Text><Text style={styles.title}>일정 수정</Text><Text style={styles.subtitle}>여기서 바꾸면 휴대폰 캘린더에도 바로 반영됩니다.</Text></View></View>
    <Card>
      <Field label="제목" value={title} onChangeText={setTitle} placeholder="일정 제목" />
      <Field label="날짜" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      <View style={styles.allDayRow}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>하루 종일</Text><Text style={styles.fieldHint}>시간 없이 날짜만 기록합니다.</Text></View><Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.accentSoft }} thumbColor={allDay ? colors.accent : '#D3D1D8'} /></View>
      {!allDay ? <View style={styles.timeRow}><View style={{ flex: 1 }}><Field label="시작" value={startTime} onChangeText={setStartTime} placeholder="15:00" /></View><View style={{ flex: 1 }}><Field label="종료" value={endTime} onChangeText={setEndTime} placeholder="16:00" /></View></View> : null}
      <Field label="장소" value={location} onChangeText={setLocation} placeholder="선택 사항" />
      <Field label="메모" value={notes} onChangeText={setNotes} placeholder="선택 사항" multiline />
    </Card>
    <Button label={busy ? '처리 중…' : '변경사항 저장'} disabled={busy} onPress={() => void save()} />
    <Pressable disabled={busy} onPress={remove} style={styles.deleteButton}><Text style={styles.deleteText}>이 일정 삭제</Text></Pressable>
    <Text style={styles.footer}>읽기 전용/공유 캘린더는 기기 정책에 따라 수정 또는 삭제가 제한될 수 있습니다.</Text>
  </Page>;
}

const styles = StyleSheet.create({
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},backButton:{width:46,height:46,borderRadius:16,borderWidth:1,borderColor:colors.lineStrong,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:34,lineHeight:38,fontWeight:'500',marginTop:-2},eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:4},title:{color:colors.text,fontSize:29,lineHeight:35,fontWeight:'900',letterSpacing:-0.8},subtitle:{color:colors.muted,fontSize:12,lineHeight:19,marginTop:5},fieldWrap:{gap:6},fieldLabel:{color:colors.text,fontSize:12,fontWeight:'900'},fieldHint:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:2},input:{minHeight:48,backgroundColor:'#F7F6FA',borderRadius:14,borderWidth:1,borderColor:colors.line,paddingHorizontal:13,color:colors.text,fontSize:14,fontWeight:'600'},multiline:{minHeight:100,paddingTop:13,textAlignVertical:'top'},timeRow:{flexDirection:'row',gap:10},allDayRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4},deleteButton:{minHeight:50,borderRadius:16,borderWidth:1,borderColor:'#FFD7D7',backgroundColor:'#FFF5F5',alignItems:'center',justifyContent:'center'},deleteText:{color:colors.red,fontSize:13,fontWeight:'900'},footer:{color:colors.muted,fontSize:10,lineHeight:16,textAlign:'center',paddingHorizontal:16},error:{color:colors.red,fontSize:13,lineHeight:20,fontWeight:'700'}
});
