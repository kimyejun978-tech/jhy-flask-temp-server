import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Page } from '@/components/Ui';
import { colors, radius } from '@/theme';
import {
  buildManualDraft,
  createDeviceCalendarEvent,
  formatInputDate,
  formatInputTime,
  parseNaturalCalendarText,
  type CalendarDraft,
} from '@/calendar-create';

const EXAMPLES = ['내일 오후 3시 수학 수행평가', '금요일 7시 축구', '9월 3일 오후 2시 기업탐방', '다음주 월요일 회의'];

function previewDate(draft: CalendarDraft) {
  if (draft.allDay) {
    return draft.startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) + ' · 하루 종일';
  }
  const date = draft.startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const start = draft.startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const end = draft.endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${start} ~ ${end}`;
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A98A5"
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

export default function CalendarAddScreen() {
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const [mode, setMode] = useState<'natural' | 'manual'>(params.mode === 'manual' ? 'manual' : 'natural');
  const [naturalText, setNaturalText] = useState('');
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

  const naturalPreview = useMemo(() => {
    if (!naturalText.trim()) return { draft: null as CalendarDraft | null, error: '' };
    try {
      return { draft: parseNaturalCalendarText(naturalText), error: '' };
    } catch (e) {
      return { draft: null, error: e instanceof Error ? e.message : '입력을 해석하지 못했습니다.' };
    }
  }, [naturalText]);

  const saveDraft = async (draft: CalendarDraft) => {
    setBusy(true);
    try {
      const result = await createDeviceCalendarEvent(draft);
      Alert.alert('일정을 추가했어요', `${result.calendarTitle}에 “${draft.title}” 일정을 저장했습니다.`, [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('추가하지 못했어요', e instanceof Error ? e.message : '캘린더에 일정을 추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveNatural = async () => {
    if (!naturalPreview.draft) {
      Alert.alert('일정을 입력해주세요', naturalPreview.error || '예: 내일 오후 3시 수학 수행평가');
      return;
    }
    await saveDraft(naturalPreview.draft);
  };

  const saveManual = async () => {
    try {
      const draft = buildManualDraft({ title, date, startTime, endTime, allDay, notes, location });
      await saveDraft(draft);
    } catch (e) {
      Alert.alert('입력을 확인해주세요', e instanceof Error ? e.message : '입력값을 확인해주세요.');
    }
  };

  return (
    <Page style={{ paddingBottom: 70 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>QUICK ADD</Text>
          <Text style={styles.title}>일정 추가</Text>
          <Text style={styles.subtitle}>말하듯 적거나, 날짜와 시간을 직접 입력해서 휴대폰 캘린더에 바로 저장해요.</Text>
        </View>
      </View>

      {params.from === 'widget' ? <Badge tone="purple">홈 화면 위젯에서 열었어요</Badge> : null}

      <View style={styles.switcher}>
        <Pressable onPress={() => setMode('natural')} style={[styles.switchItem, mode === 'natural' && styles.switchItemActive]}>
          <Text style={[styles.switchText, mode === 'natural' && styles.switchTextActive]}>자연어로 추가</Text>
        </Pressable>
        <Pressable onPress={() => setMode('manual')} style={[styles.switchItem, mode === 'manual' && styles.switchItemActive]}>
          <Text style={[styles.switchText, mode === 'manual' && styles.switchTextActive]}>직접 입력</Text>
        </Pressable>
      </View>

      {mode === 'natural' ? (
        <>
          <Card style={styles.naturalCard}>
            <Text style={styles.cardEyebrow}>NATURAL LANGUAGE</Text>
            <Text style={styles.cardTitle}>그냥 말하듯 적어보세요.</Text>
            <TextInput
              autoFocus
              value={naturalText}
              onChangeText={setNaturalText}
              multiline
              placeholder="예) 내일 오후 3시 수학 수행평가"
              placeholderTextColor="#9B98A7"
              style={styles.naturalInput}
              returnKeyType="done"
            />
            <View style={styles.exampleWrap}>
              {EXAMPLES.map((example) => (
                <Pressable key={example} onPress={() => setNaturalText(example)} style={styles.exampleChip}>
                  <Text style={styles.exampleText}>{example}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {naturalText.trim() ? (
            <Card>
              <Text style={styles.cardEyebrow}>PREVIEW</Text>
              {naturalPreview.draft ? (
                <>
                  <Text style={styles.previewTitle}>{naturalPreview.draft.title}</Text>
                  <Text style={styles.previewDate}>{previewDate(naturalPreview.draft)}</Text>
                  <Text style={styles.previewHint}>저장하기 전 한 번 확인해 주세요. 필요하면 위 문장을 바로 고치면 미리보기도 같이 바뀝니다.</Text>
                </>
              ) : (
                <Text style={styles.errorText}>{naturalPreview.error}</Text>
              )}
            </Card>
          ) : null}

          <Button label={busy ? '저장 중…' : '이 일정 저장'} onPress={() => { void saveNatural(); }} disabled={busy} />
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.cardEyebrow}>MANUAL</Text>
            <Text style={styles.cardTitle}>날짜와 시간을 직접 정해요.</Text>
            <Field label="제목" value={title} onChangeText={setTitle} placeholder="예) 수학 수행평가" />
            <Field label="날짜" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

            <View style={styles.allDayRow}>
              <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>하루 종일</Text><Text style={styles.fieldHint}>시간 없이 날짜만 기록합니다.</Text></View>
              <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.accentSoft }} thumbColor={allDay ? colors.accent : '#D3D1D8'} />
            </View>

            {!allDay ? (
              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}><Field label="시작" value={startTime} onChangeText={setStartTime} placeholder="15:00" /></View>
                <View style={{ flex: 1 }}><Field label="종료" value={endTime} onChangeText={setEndTime} placeholder="16:00" /></View>
              </View>
            ) : null}

            <Field label="장소 (선택)" value={location} onChangeText={setLocation} placeholder="예) 세미나실" />
            <Field label="메모 (선택)" value={notes} onChangeText={setNotes} placeholder="필요한 내용 메모" multiline />
          </Card>
          <Button label={busy ? '저장 중…' : '캘린더에 추가'} onPress={() => { void saveManual(); }} disabled={busy} />
        </>
      )}

      <Text style={styles.footer}>DevFeed는 새 일정을 기기의 수정 가능한 캘린더에 저장합니다. 저장된 일정은 일정 탭에서 다시 읽어옵니다.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '500', marginTop: -2 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  switcher: { flexDirection: 'row', padding: 4, borderRadius: 18, backgroundColor: '#ECEAF2', gap: 4 },
  switchItem: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  switchItemActive: { backgroundColor: colors.surface },
  switchText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  switchTextActive: { color: colors.accentDark },
  naturalCard: { backgroundColor: '#F0EAFE', borderColor: '#E6DBFF' },
  cardEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  cardTitle: { color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4 },
  naturalInput: { minHeight: 132, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15, color: colors.text, fontSize: 18, lineHeight: 27, fontWeight: '700', textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2D9F6' },
  exampleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  exampleChip: { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  exampleText: { color: '#5D566B', fontSize: 11, fontWeight: '700' },
  previewTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900' },
  previewDate: { color: colors.accentDark, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  previewHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  errorText: { color: colors.red, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  fieldHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
  input: { minHeight: 48, backgroundColor: '#F7F6FA', borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, color: colors.text, fontSize: 14, fontWeight: '600' },
  multiline: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 10 },
  allDayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 12 },
});
