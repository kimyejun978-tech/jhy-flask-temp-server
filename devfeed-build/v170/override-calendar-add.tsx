import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Page } from '@/components/Ui';
import { colors, radius } from '@/theme';
import {
  buildManualDraft,
  createDeviceCalendarEvent,
  formatInputDate,
  formatInputTime,
  isCalendarAiRequestCancelled,
  parseNaturalCalendarTextWithAI,
  type AiCalendarParseResult,
  type CalendarDraft,
} from '@/calendar-create';

const EXAMPLES = ['내일까지 핀맵 완성', '내일 오후 3시 수학 수행평가', '금요일 오후 7시 축구', '9월 3일 오후 2시 기업탐방'];
type AiPhase = 'idle' | 'typing' | 'parsing' | 'ready' | 'parseError' | 'saving' | 'success' | 'saveError';

function previewDate(draft: CalendarDraft) {
  if (draft.allDay) return `${draft.startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} · 하루 종일`;
  const date = draft.startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const start = draft.startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const end = draft.endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${start} ~ ${end}`;
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#777482" multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function ScreenFrame({ children }: { children: ReactNode }) {
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{children}</KeyboardAvoidingView>;
}

function ExampleChips({ compact = false, onSelect }: { compact?: boolean; onSelect: (value: string) => void }) {
  const items = compact ? EXAMPLES.slice(0, 3) : EXAMPLES;
  return <View style={styles.exampleWrap}>{items.map((example) => <Pressable accessibilityRole="button" accessibilityLabel={`예시 입력: ${example}`} key={example} onPress={() => onSelect(example)} style={({ pressed }) => [styles.exampleChip, pressed && styles.pressed]}><Text style={styles.exampleText}>{example}</Text></Pressable>)}</View>;
}

export default function CalendarAddScreen() {
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const fromWidget = params.from === 'widget';
  const [mode, setMode] = useState<'natural' | 'manual'>(params.mode === 'manual' ? 'manual' : 'natural');
  const [naturalText, setNaturalText] = useState('');
  const [aiResult, setAiResult] = useState<AiCalendarParseResult | null>(null);
  const [aiPhase, setAiPhase] = useState<AiPhase>('idle');
  const [aiError, setAiError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useMemo(() => new Date(), []);
  const initialEnd = useMemo(() => new Date(now.getTime() + 60 * 60 * 1000), [now]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(formatInputDate(now));
  const [startTime, setStartTime] = useState(formatInputTime(now));
  const [endTime, setEndTime] = useState(formatInputTime(initialEnd));
  const [allDay, setAllDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  const requestParse = async (text: string) => {
    const normalized = text.trim();
    if (!normalized) return null;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const sequence = ++requestSequence.current;
    setAiPhase('parsing');
    setAiError('');
    try {
      const result = await parseNaturalCalendarTextWithAI(normalized, controller.signal);
      if (sequence !== requestSequence.current || controller.signal.aborted) return null;
      setAiResult(result);
      setAiPhase('ready');
      return result;
    } catch (error) {
      if (isCalendarAiRequestCancelled(error) || sequence !== requestSequence.current) return null;
      const message = error instanceof Error ? error.message : 'AI가 일정을 해석하지 못했어요.';
      setAiResult(null);
      setAiError(message);
      setAiPhase('parseError');
      return null;
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  };

  useEffect(() => {
    requestController.current?.abort();
    requestSequence.current += 1;
    if (mode !== 'natural' || !naturalText.trim()) {
      setAiResult(null);
      setAiError('');
      setAiPhase('idle');
      return;
    }
    setAiResult(null);
    setAiError('');
    setAiPhase('typing');
    debounceTimer.current = setTimeout(() => { debounceTimer.current = null; void requestParse(naturalText); }, 480);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    };
  }, [naturalText, mode]);

  useEffect(() => () => {
    requestController.current?.abort();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (successTimer.current) clearTimeout(successTimer.current);
  }, []);

  const saveDraft = async (draft: CalendarDraft, natural = false) => {
    Keyboard.dismiss();
    setBusy(true);
    if (natural) setAiPhase('saving');
    try {
      const result = await createDeviceCalendarEvent(draft);
      if (natural) {
        setAiError('');
        setAiPhase('success');
        AccessibilityInfo.announceForAccessibility(`${result.calendarTitle}에 ${draft.title} 일정을 저장했습니다.`);
        successTimer.current = setTimeout(() => router.back(), 850);
      } else {
        Alert.alert('일정을 추가했어요', `${result.calendarTitle}에 “${draft.title}” 일정을 저장했습니다.`, [{ text: '확인', onPress: () => router.back() }]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '캘린더에 일정을 추가하지 못했습니다.';
      if (natural) {
        setAiError(message);
        setAiPhase('saveError');
      } else {
        Alert.alert('추가하지 못했어요', message);
      }
    } finally {
      setBusy(false);
    }
  };

  const resolveNatural = async () => {
    const text = naturalText.trim();
    if (!text) {
      setAiError('예: 내일 오후 3시 수학 수행평가');
      setAiPhase('parseError');
      return null;
    }
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (aiResult?.draft.sourceText === text) return aiResult;
    return requestParse(text);
  };

  const saveNatural = async (fast = false) => {
    if (busy || aiPhase === 'parsing') return;
    Keyboard.dismiss();
    const result = await resolveNatural();
    if (!result) return;
    if (result.needsConfirmation && fast) {
      setAiPhase('ready');
      AccessibilityInfo.announceForAccessibility('날짜나 시간이 애매합니다. 미리보기를 확인해 주세요.');
      return;
    }
    await saveDraft(result.draft, true);
  };

  const saveManual = async () => {
    try { await saveDraft(buildManualDraft({ title, date, startTime, endTime, allDay, notes, location })); }
    catch (error) { Alert.alert('입력을 확인해주세요', error instanceof Error ? error.message : '입력값을 확인해주세요.'); }
  };

  const retry = () => { if (!busy && naturalText.trim()) void requestParse(naturalText); };
  const preview = aiResult?.draft ?? null;
  const inputBusy = aiPhase === 'parsing' || aiPhase === 'saving';

  const statusPanel = <View accessibilityLiveRegion="polite" accessibilityRole="summary" style={[styles.statusPanel, (aiPhase === 'parseError' || aiPhase === 'saveError') && styles.statusPanelError, aiPhase === 'success' && styles.statusPanelSuccess]}>
    {aiPhase === 'parsing' ? <View style={styles.statusRow}><ActivityIndicator color={colors.accent} /><View style={styles.statusCopy}><Text style={styles.statusTitle}>날짜와 시간을 확인하고 있어요</Text><Text style={styles.statusHint}>문장을 읽고 일정 형식으로 정리하는 중입니다.</Text></View></View> : null}
    {aiPhase === 'saving' ? <View style={styles.statusRow}><ActivityIndicator color={colors.accent} /><View style={styles.statusCopy}><Text style={styles.statusTitle}>캘린더에 저장하고 있어요</Text><Text style={styles.statusHint}>중복 저장을 막고 있으니 잠시만 기다려 주세요.</Text></View></View> : null}
    {aiPhase === 'success' ? <View style={styles.statusCopy}><Text style={styles.successTitle}>일정을 저장했어요</Text><Text style={styles.statusHint}>캘린더에서 바로 확인할 수 있어요.</Text></View> : null}
    {(aiPhase === 'parseError' || aiPhase === 'saveError') ? <View style={styles.statusCopy}><Text style={styles.errorTitle}>{aiPhase === 'saveError' ? '캘린더에 저장하지 못했어요' : 'AI가 해석하지 못했어요'}</Text><Text style={styles.errorText}>{aiError}</Text><View style={styles.actionRow}><View style={styles.actionCell}><Button label="다시 시도" variant="secondary" onPress={retry} disabled={busy} /></View><View style={styles.actionCell}><Button label="직접 입력" variant="ghost" onPress={() => setMode('manual')} disabled={busy} /></View></View></View> : null}
    {aiPhase === 'ready' && preview ? <View style={styles.statusCopy}><View style={styles.previewTop}><Text style={styles.cardEyebrow}>일정 미리보기</Text><Badge tone={aiResult?.needsConfirmation ? 'orange' : 'purple'}>{aiResult?.needsConfirmation ? '확인 필요' : '해석 완료'}</Badge></View><Text style={styles.previewTitle}>{preview.title}</Text><Text style={styles.previewDate}>{previewDate(preview)}</Text>{aiResult?.interpretation ? <Text style={styles.statusHint}>{aiResult.interpretation}</Text> : null}<Button label={busy ? '저장 중…' : '캘린더에 저장'} loading={busy} onPress={() => void saveNatural(false)} disabled={busy} /></View> : null}
    {(aiPhase === 'idle' || aiPhase === 'typing') ? <View style={styles.statusCopy}><Text style={styles.statusTitle}>{aiPhase === 'typing' ? '입력을 마치면 바로 해석해요' : '말하듯 한 줄로 적어보세요'}</Text><Text style={styles.statusHint}>날짜, 시간, 할 일을 함께 적으면 더 정확해요.</Text></View> : null}
  </View>;

  if (fromWidget && mode === 'natural') {
    return <ScreenFrame><Page style={{ paddingTop: 8, paddingBottom: 40 }}>
      <View style={styles.quickHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="일정 추가 닫기" onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Text style={styles.closeText}>닫기</Text></Pressable>
        <View style={styles.headerCopy}><Text style={styles.quickEyebrow}>QUICK ADD</Text><Text style={styles.quickTitle}>일정 바로 추가</Text></View>
      </View>
      <View style={[styles.commandBar, inputBusy && styles.commandBarBusy]}>
        <TextInput accessibilityLabel="자연어 일정 입력" accessibilityHint="예: 내일 오후 3시 수학 수행평가" autoFocus value={naturalText} onChangeText={setNaturalText} editable={!busy} placeholder="내일 오후 3시 수학 수행평가" placeholderTextColor="#777482" style={styles.quickInput} returnKeyType="done" blurOnSubmit onSubmitEditing={() => { if (!inputBusy && naturalText.trim()) void saveNatural(true); }} />
        <Pressable accessibilityRole="button" accessibilityLabel={aiPhase === 'ready' ? '일정 저장' : '일정 해석'} accessibilityState={{ disabled: inputBusy || !naturalText.trim(), busy: inputBusy }} disabled={inputBusy || !naturalText.trim()} onPress={() => void saveNatural(true)} style={({ pressed }) => [styles.commandAction, (pressed || inputBusy || !naturalText.trim()) && styles.commandActionDisabled]}>{inputBusy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.commandActionText}>{aiPhase === 'ready' ? '저장' : '추가'}</Text>}</Pressable>
      </View>
      {statusPanel}
      {(aiPhase === 'idle' || aiPhase === 'typing') ? <ExampleChips compact onSelect={setNaturalText} /> : null}
      <Pressable accessibilityRole="button" onPress={() => setMode('manual')} style={styles.manualLink}><Text style={styles.manualLinkText}>날짜와 시간을 직접 입력하기</Text></Pressable>
    </Page></ScreenFrame>;
  }

  return <ScreenFrame><Page style={{ paddingBottom: 70 }}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="일정 추가 닫기" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>닫기</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>CALENDAR CREATE</Text><Text style={styles.title}>일정 추가</Text><Text style={styles.subtitle}>말하듯 입력하거나 날짜와 시간을 직접 정할 수 있어요.</Text></View></View>
    <View accessibilityRole="tablist" style={styles.switcher}><Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'natural' }} onPress={() => setMode('natural')} style={[styles.switchItem, mode === 'natural' && styles.switchItemActive]}><Text style={[styles.switchText, mode === 'natural' && styles.switchTextActive]}>AI로 추가</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'manual' }} onPress={() => setMode('manual')} style={[styles.switchItem, mode === 'manual' && styles.switchItemActive]}><Text style={[styles.switchText, mode === 'manual' && styles.switchTextActive]}>직접 입력</Text></Pressable></View>
    {mode === 'natural' ? <>
      <Card style={styles.naturalCard}><Text style={styles.cardEyebrow}>AI INPUT</Text><Text style={styles.cardTitle}>무엇을 언제 할지 적어보세요.</Text><TextInput accessibilityLabel="자연어 일정 입력" accessibilityHint="날짜, 시간, 할 일을 한 문장으로 입력하세요" autoFocus value={naturalText} onChangeText={setNaturalText} editable={!busy} multiline placeholder="예) 내일 오후 3시 수학 수행평가" placeholderTextColor="#777482" style={styles.naturalInput} /><ExampleChips onSelect={setNaturalText} /></Card>
      {statusPanel}
      {aiPhase !== 'ready' ? <Button label={aiPhase === 'parsing' ? 'AI 해석 중…' : aiPhase === 'saving' ? '캘린더 저장 중…' : '이 일정 확인'} loading={inputBusy} onPress={() => void saveNatural(false)} disabled={busy || !naturalText.trim()} /> : null}
    </> : <>
      <Card><Text style={styles.cardEyebrow}>MANUAL</Text><Text style={styles.cardTitle}>날짜와 시간을 직접 정해요.</Text><Field label="제목" value={title} onChangeText={setTitle} placeholder="예) 수학 수행평가" /><Field label="날짜" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><View style={styles.allDayRow}><View style={styles.allDayCopy}><Text style={styles.fieldLabel}>하루 종일</Text><Text style={styles.fieldHint}>시간 없이 날짜만 기록합니다.</Text></View><Switch accessibilityLabel="하루 종일 일정" value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.accentSoft }} thumbColor={allDay ? colors.accent : '#D3D1D8'} /></View>{!allDay ? <View style={styles.timeRow}><View style={styles.flex}><Field label="시작" value={startTime} onChangeText={setStartTime} placeholder="15:00" /></View><View style={styles.flex}><Field label="종료" value={endTime} onChangeText={setEndTime} placeholder="16:00" /></View></View> : null}<Field label="장소 (선택)" value={location} onChangeText={setLocation} placeholder="예) 세미나실" /><Field label="메모 (선택)" value={notes} onChangeText={setNotes} placeholder="필요한 내용 메모" multiline /></Card><Button label={busy ? '저장 중…' : '캘린더에 추가'} loading={busy} onPress={() => void saveManual()} disabled={busy} />
    </>}
  </Page></ScreenFrame>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.62 },
  headerCopy: { flex: 1, minWidth: 0 },
  quickHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 2 },
  closeButton: { minWidth: 48, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  quickEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  quickTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.6, marginTop: 2 },
  commandBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 17, paddingRight: 7, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1.5, borderColor: colors.lineStrong },
  commandBarBusy: { borderColor: colors.accentSoft, backgroundColor: '#FCFAFF' },
  quickInput: { flex: 1, minWidth: 0, height: 56, color: colors.text, fontSize: 16, fontWeight: '700' },
  commandAction: { minWidth: 58, height: 48, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  commandActionDisabled: { opacity: 0.42 },
  commandActionText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  statusPanel: { minHeight: 126, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, justifyContent: 'center' },
  statusPanelError: { backgroundColor: colors.redSoft, borderColor: '#F2C9CF' },
  statusPanelSuccess: { backgroundColor: colors.greenSoft, borderColor: '#C7E7D2' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  statusCopy: { gap: 7 },
  statusTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  statusHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  successTitle: { color: colors.green, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  errorTitle: { color: colors.red, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  errorText: { color: '#804650', fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, paddingTop: 3 },
  actionCell: { flex: 1 },
  manualLink: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  manualLinkText: { color: colors.accentDark, fontSize: 12, fontWeight: '900' },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { minWidth: 48, minHeight: 46, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  switcher: { flexDirection: 'row', padding: 4, borderRadius: 18, backgroundColor: '#ECEAF2', gap: 4 },
  switchItem: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  switchItemActive: { backgroundColor: colors.surface },
  switchText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  switchTextActive: { color: colors.accentDark },
  naturalCard: { backgroundColor: '#F4F0FC', borderColor: '#E4DCF4' },
  cardEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  cardTitle: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900', letterSpacing: -0.35 },
  naturalInput: { minHeight: 112, backgroundColor: colors.surface, borderRadius: 17, paddingHorizontal: 16, paddingVertical: 15, color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: '700', textAlignVertical: 'top', borderWidth: 1, borderColor: '#DED5EF' },
  exampleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  exampleChip: { backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 8 },
  exampleText: { color: '#5D5967', fontSize: 11, fontWeight: '700' },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900' },
  previewDate: { color: colors.accentDark, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  fieldHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
  input: { minHeight: 48, backgroundColor: '#F7F6FA', borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, color: colors.text, fontSize: 14, fontWeight: '600' },
  multiline: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 10 },
  allDayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  allDayCopy: { flex: 1 },
});
