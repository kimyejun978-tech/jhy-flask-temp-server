import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Page } from '@/components/Ui';
import { colors, radius } from '@/theme';
import {
  buildManualDraft,
  createDeviceCalendarEvent,
  formatInputDate,
  formatInputTime,
  parseNaturalCalendarTextWithAI,
  type AiCalendarParseResult,
  type CalendarDraft,
} from '@/calendar-create';

const EXAMPLES = ['내일까지 핀맵 완성', '내일 오후 3시 수학 수행평가', '금요일 7시 축구', '9월 3일 오후 2시 기업탐방'];

function previewDate(draft: CalendarDraft) {
  if (draft.allDay) return `${draft.startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} · 하루 종일`;
  const date = draft.startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const start = draft.startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const end = draft.endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${start} ~ ${end}`;
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9A98A5" multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function CalendarAddScreen() {
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const fromWidget = params.from === 'widget';
  const [mode, setMode] = useState<'natural' | 'manual'>(params.mode === 'manual' ? 'manual' : 'natural');
  const [naturalText, setNaturalText] = useState('');
  const [aiResult, setAiResult] = useState<AiCalendarParseResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);
  const initialEnd = useMemo(() => new Date(now.getTime() + 60 * 60 * 1000), [now]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(formatInputDate(now));
  const [startTime, setStartTime] = useState(formatInputTime(now));
  const [endTime, setEndTime] = useState(formatInputTime(initialEnd));
  const [allDay, setAllDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (mode !== 'natural' || !naturalText.trim()) { setAiResult(null); setAiError(''); setAiLoading(false); return; }
    let active = true;
    const timer = setTimeout(() => {
      setAiLoading(true); setAiError('');
      void parseNaturalCalendarTextWithAI(naturalText).then((result) => {
        if (!active) return;
        setAiResult(result);
      }).catch((e) => {
        if (!active) return;
        setAiResult(null); setAiError(e instanceof Error ? e.message : 'AI 해석에 실패했습니다.');
      }).finally(() => { if (active) setAiLoading(false); });
    }, 550);
    return () => { active = false; clearTimeout(timer); };
  }, [naturalText, mode]);

  const saveDraft = async (draft: CalendarDraft) => {
    setBusy(true);
    try {
      const result = await createDeviceCalendarEvent(draft);
      Alert.alert('일정을 추가했어요', `${result.calendarTitle}에 “${draft.title}” 일정을 저장했습니다.`, [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) { Alert.alert('추가하지 못했어요', e instanceof Error ? e.message : '캘린더에 일정을 추가하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const resolveNatural = async () => {
    const text = naturalText.trim();
    if (!text) throw new Error('예: 내일까지 핀맵 완성');
    if (aiResult?.draft.sourceText === text) return aiResult;
    setAiLoading(true); setAiError('');
    try { const result = await parseNaturalCalendarTextWithAI(text); setAiResult(result); return result; }
    finally { setAiLoading(false); }
  };

  const saveNatural = async (fast = false) => {
    try {
      const result = await resolveNatural();
      if (result.needsConfirmation && fast) {
        Alert.alert('한 번 확인해주세요', 'AI가 문장을 해석했지만 날짜나 시간이 조금 애매합니다. 아래 미리보기를 확인한 뒤 저장해주세요.');
        return;
      }
      await saveDraft(result.draft);
    } catch (e) { const message = e instanceof Error ? e.message : 'AI가 일정을 해석하지 못했습니다.'; setAiError(message); Alert.alert('AI 일정 해석 실패', message); }
  };

  const saveManual = async () => {
    try { await saveDraft(buildManualDraft({ title, date, startTime, endTime, allDay, notes, location })); }
    catch (e) { Alert.alert('입력을 확인해주세요', e instanceof Error ? e.message : '입력값을 확인해주세요.'); }
  };

  const preview = aiResult?.draft ?? null;

  if (fromWidget && mode === 'natural') {
    return <Page style={{ paddingTop: 8, paddingBottom: 40 }}>
      <View style={styles.quickHeader}>
        <Pressable onPress={() => router.back()} style={styles.quickClose}><Text style={styles.quickCloseText}>‹</Text></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.quickEyebrow}>AI QUICK ADD</Text><Text style={styles.quickTitle}>말하듯 적으면 AI가 일정으로 바꿔요.</Text></View>
      </View>
      <View style={styles.searchInputShell}>
        <View style={styles.searchMark}><Text style={styles.searchMarkText}>+</Text></View>
        <TextInput autoFocus value={naturalText} onChangeText={setNaturalText} placeholder="예) 내일까지 핀맵 완성" placeholderTextColor="#8D8A96" style={styles.quickInput} returnKeyType="done" blurOnSubmit={false} onSubmitEditing={() => { if (!busy && !aiLoading && naturalText.trim()) void saveNatural(true); }} />
        <Pressable disabled={busy || aiLoading || !naturalText.trim()} onPress={() => void saveNatural(true)} style={[styles.quickGo, (busy || aiLoading || !naturalText.trim()) && { opacity: 0.35 }]}><Text style={styles.quickGoText}>{aiLoading ? '…' : '→'}</Text></Pressable>
      </View>
      <Text style={styles.quickHint}>{aiLoading ? 'AI가 날짜와 시간을 해석하는 중…' : 'Cloudflare AI가 현재 시각 기준으로 오늘/내일/요일/시간 표현을 해석합니다.'}</Text>
      {preview ? <Card style={styles.quickPreview}><View style={styles.previewTop}><Text style={styles.cardEyebrow}>AI PREVIEW</Text><Badge tone={aiResult?.needsConfirmation ? 'orange' : 'purple'}>{aiResult?.needsConfirmation ? '확인 필요' : 'AI 해석 완료'}</Badge></View><Text style={styles.previewTitle}>{preview.title}</Text><Text style={styles.previewDate}>{previewDate(preview)}</Text>{aiResult?.interpretation ? <Text style={styles.previewHint}>{aiResult.interpretation}</Text> : null}{aiResult?.needsConfirmation ? <Button label="이 해석으로 저장" onPress={() => void saveNatural(false)} disabled={busy} /> : null}</Card> : null}
      {aiError ? <Card><Text style={styles.errorText}>{aiError}</Text><Text style={styles.previewHint}>AI가 연결되지 않으면 잘못된 날짜로 임의 저장하지 않습니다. 직접 입력으로 전환할 수 있어요.</Text></Card> : null}
      <View style={styles.quickExamples}>{EXAMPLES.slice(0, 3).map(example => <Pressable key={example} onPress={() => setNaturalText(example)} style={styles.exampleChip}><Text style={styles.exampleText}>{example}</Text></Pressable>)}</View>
      <Pressable onPress={() => setMode('manual')} style={styles.manualLink}><Text style={styles.manualLinkText}>날짜와 시간을 직접 입력하기</Text></Pressable>
    </Page>;
  }

  return <Page style={{ paddingBottom: 70 }}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.eyebrow}>CALENDAR CREATE</Text><Text style={styles.title}>일정 추가</Text><Text style={styles.subtitle}>AI 자연어 입력 또는 직접 입력으로 휴대폰 캘린더에 저장합니다.</Text></View></View>
    <View style={styles.switcher}><Pressable onPress={() => setMode('natural')} style={[styles.switchItem, mode === 'natural' && styles.switchItemActive]}><Text style={[styles.switchText, mode === 'natural' && styles.switchTextActive]}>AI로 추가</Text></Pressable><Pressable onPress={() => setMode('manual')} style={[styles.switchItem, mode === 'manual' && styles.switchItemActive]}><Text style={[styles.switchText, mode === 'manual' && styles.switchTextActive]}>직접 입력</Text></Pressable></View>
    {mode === 'natural' ? <>
      <Card style={styles.naturalCard}><View style={styles.previewTop}><Text style={styles.cardEyebrow}>CLOUDFLARE AI</Text><Badge tone="purple">AI</Badge></View><Text style={styles.cardTitle}>그냥 말하듯 적어보세요.</Text><TextInput autoFocus value={naturalText} onChangeText={setNaturalText} multiline placeholder="예) 내일까지 핀맵 완성" placeholderTextColor="#9B98A7" style={styles.naturalInput} /><View style={styles.exampleWrap}>{EXAMPLES.map(example => <Pressable key={example} onPress={() => setNaturalText(example)} style={styles.exampleChip}><Text style={styles.exampleText}>{example}</Text></Pressable>)}</View></Card>
      {aiLoading ? <Card><Text style={styles.previewTitle}>AI가 해석하고 있어요…</Text><Text style={styles.previewHint}>현재 날짜와 시간대를 기준으로 문장을 일정 데이터로 바꾸는 중입니다.</Text></Card> : null}
      {preview && !aiLoading ? <Card><View style={styles.previewTop}><Text style={styles.cardEyebrow}>AI PREVIEW</Text><Badge tone={aiResult?.needsConfirmation ? 'orange' : 'purple'}>{aiResult?.needsConfirmation ? '확인 필요' : '해석 완료'}</Badge></View><Text style={styles.previewTitle}>{preview.title}</Text><Text style={styles.previewDate}>{previewDate(preview)}</Text>{aiResult?.interpretation ? <Text style={styles.previewHint}>{aiResult.interpretation}</Text> : null}</Card> : null}
      {aiError ? <Card><Text style={styles.errorText}>{aiError}</Text></Card> : null}
      <Button label={busy ? '저장 중…' : aiLoading ? 'AI 해석 중…' : '이 일정 저장'} onPress={() => void saveNatural(false)} disabled={busy || aiLoading || !naturalText.trim()} />
    </> : <>
      <Card><Text style={styles.cardEyebrow}>MANUAL</Text><Text style={styles.cardTitle}>날짜와 시간을 직접 정해요.</Text><Field label="제목" value={title} onChangeText={setTitle} placeholder="예) 수학 수행평가" /><Field label="날짜" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><View style={styles.allDayRow}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>하루 종일</Text><Text style={styles.fieldHint}>시간 없이 날짜만 기록합니다.</Text></View><Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.accentSoft }} thumbColor={allDay ? colors.accent : '#D3D1D8'} /></View>{!allDay ? <View style={styles.timeRow}><View style={{ flex: 1 }}><Field label="시작" value={startTime} onChangeText={setStartTime} placeholder="15:00" /></View><View style={{ flex: 1 }}><Field label="종료" value={endTime} onChangeText={setEndTime} placeholder="16:00" /></View></View> : null}<Field label="장소 (선택)" value={location} onChangeText={setLocation} placeholder="예) 세미나실" /><Field label="메모 (선택)" value={notes} onChangeText={setNotes} placeholder="필요한 내용 메모" multiline /></Card><Button label={busy ? '저장 중…' : '캘린더에 추가'} onPress={() => void saveManual()} disabled={busy} />
    </>}
  </Page>;
}

const styles = StyleSheet.create({
  quickHeader:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:6},quickClose:{width:42,height:42,borderRadius:15,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'},quickCloseText:{color:colors.text,fontSize:31,lineHeight:34,marginTop:-2},quickEyebrow:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.6},quickTitle:{color:colors.text,fontSize:20,lineHeight:26,fontWeight:'900',letterSpacing:-0.4,marginTop:2},searchInputShell:{minHeight:66,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,backgroundColor:'#FFFFFF',borderRadius:28,borderWidth:1,borderColor:'#DDD9E6'},searchMark:{width:38,height:38,borderRadius:19,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},searchMarkText:{color:'#fff',fontSize:25,lineHeight:28,fontWeight:'500'},quickInput:{flex:1,minWidth:0,height:56,color:colors.text,fontSize:16,fontWeight:'700'},quickGo:{width:38,height:38,borderRadius:19,backgroundColor:'#EEE8FF',alignItems:'center',justifyContent:'center'},quickGoText:{color:colors.accentDark,fontSize:21,fontWeight:'900'},quickHint:{color:colors.muted,fontSize:11,lineHeight:17,paddingHorizontal:8},quickPreview:{paddingVertical:14},quickExamples:{flexDirection:'row',flexWrap:'wrap',gap:7},manualLink:{minHeight:44,alignItems:'center',justifyContent:'center'},manualLinkText:{color:colors.accentDark,fontSize:12,fontWeight:'900'},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},backButton:{width:46,height:46,borderRadius:16,borderWidth:1,borderColor:colors.lineStrong,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:34,lineHeight:38,fontWeight:'500',marginTop:-2},eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:4},title:{color:colors.text,fontSize:30,lineHeight:36,fontWeight:'900',letterSpacing:-1},subtitle:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:5},switcher:{flexDirection:'row',padding:4,borderRadius:18,backgroundColor:'#ECEAF2',gap:4},switchItem:{flex:1,minHeight:46,borderRadius:14,alignItems:'center',justifyContent:'center'},switchItemActive:{backgroundColor:colors.surface},switchText:{color:colors.muted,fontSize:13,fontWeight:'800'},switchTextActive:{color:colors.accentDark},naturalCard:{backgroundColor:'#F0EAFE',borderColor:'#E6DBFF'},cardEyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.6},cardTitle:{color:colors.text,fontSize:21,lineHeight:27,fontWeight:'900',letterSpacing:-0.4},naturalInput:{minHeight:118,backgroundColor:colors.surface,borderRadius:18,paddingHorizontal:16,paddingVertical:15,color:colors.text,fontSize:18,lineHeight:27,fontWeight:'700',textAlignVertical:'top',borderWidth:1,borderColor:'#E2D9F6'},exampleWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},exampleChip:{backgroundColor:'rgba(255,255,255,0.82)',borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:7},exampleText:{color:'#5D566B',fontSize:11,fontWeight:'700'},previewTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},previewTitle:{color:colors.text,fontSize:19,lineHeight:25,fontWeight:'900'},previewDate:{color:colors.accentDark,fontSize:14,lineHeight:21,fontWeight:'800'},previewHint:{color:colors.muted,fontSize:12,lineHeight:18},errorText:{color:colors.red,fontSize:13,lineHeight:20,fontWeight:'700'},fieldWrap:{gap:6},fieldLabel:{color:colors.text,fontSize:12,fontWeight:'900'},fieldHint:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:2},input:{minHeight:48,backgroundColor:'#F7F6FA',borderRadius:14,borderWidth:1,borderColor:colors.line,paddingHorizontal:13,color:colors.text,fontSize:14,fontWeight:'600'},multiline:{minHeight:92,paddingTop:13,textAlignVertical:'top'},timeRow:{flexDirection:'row',gap:10},allDayRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4}
});
