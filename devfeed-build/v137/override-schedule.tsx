import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Loading, Page, SectionTitle } from '@/components/Ui';
import { useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors } from '@/theme';
import {
  approximateMatchesMonth,
  conflictsWithEvent,
  eventDateLabel,
  eventPrecision,
  getEventTiming,
  hasCalendarPermission,
  isLikelySameEvent,
  loadDeviceCalendarSnapshot,
  type DeviceCalendarEvent,
} from '@/calendar';

const WEEK = ['월', '화', '수', '목', '금', '토', '일'];

function noon(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}
function shiftDay(d: Date, n: number) {
  return noon(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
function weekStart(d: Date) {
  const x = noon(d);
  const offset = (x.getDay() + 6) % 7;
  return shiftDay(x, -offset);
}
function dayKey(d: Date | string) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function monthStart(d: Date) {
  return noon(new Date(d.getFullYear(), d.getMonth(), 1));
}
function monthGridStart(d: Date) {
  const first = monthStart(d);
  const offset = (first.getDay() + 6) % 7;
  return shiftDay(first, -offset);
}
function onDay(startValue: string, endValue: string, day: Date, allDay = false) {
  const start = new Date(startValue);
  const endRaw = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endRaw.getTime())) return false;
  const end = allDay && endRaw > start ? new Date(endRaw.getTime() - 1) : endRaw;
  const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return start <= de && end >= ds;
}
function timeText(value: string, allDay = false) {
  if (allDay) return 'ALL';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function durationText(start: string, end: string, allDay = false) {
  if (allDay) return '하루 종일';
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const min = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`;
}

type TimelineItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  kind: 'devfeed' | 'device';
  subtitle: string;
  event?: EventItem;
  calendar?: string;
  conflict?: string;
};

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const schedule = useSchedule();
  const today = useMemo(() => noon(new Date()), []);

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => today);
  const [selected, setSelected] = useState(() => today);
  const [deviceEvents, setDeviceEvents] = useState<DeviceCalendarEvent[]>([]);
  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [loading, setLoading] = useState(false);
  const [calendarCount, setCalendarCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const allDev = schedule.data?.items ?? [];
  const exactDev = useMemo(
    () => allDev.filter((e) => eventPrecision(e) === 'EXACT' && Boolean(e.startDate)),
    [allDev],
  );

  const week = useMemo(() => {
    const start = weekStart(cursor);
    return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  }, [cursor]);

  const monthDays = useMemo(() => {
    const start = monthGridStart(cursor);
    return Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
  }, [cursor]);

  const loadRange = useMemo(() => {
    if (viewMode === 'month') {
      const start = monthGridStart(cursor);
      return { start: shiftDay(start, -1), end: shiftDay(start, 43) };
    }
    const start = weekStart(cursor);
    return { start: shiftDay(start, -7), end: shiftDay(start, 14) };
  }, [cursor, viewMode]);

  const load = async (request = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const granted = await hasCalendarPermission(request);
      setPermission(granted ? 'granted' : 'denied');
      if (!granted) {
        setDeviceEvents([]);
        setCalendarCount(0);
        setFailedCount(0);
        return;
      }
      const snap = await loadDeviceCalendarSnapshot(loadRange.start, loadRange.end, false);
      setDeviceEvents(snap.events);
      setCalendarCount(snap.calendarCount);
      setFailedCount(snap.failedCalendarCount);
    } catch (e) {
      setDeviceEvents([]);
      setCalendarCount(0);
      setFailedCount(0);
      setLoadError(e instanceof Error ? e.message : '캘린더를 읽지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, cursor.getFullYear(), cursor.getMonth(), dayKey(weekStart(cursor))]);

  const visibleDevice = useMemo(
    () => deviceEvents.filter((x) => !allDev.some((e) => isLikelySameEvent(e, x))),
    [deviceEvents, allDev],
  );

  const selectedItems = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];

    for (const e of exactDev) {
      const t = getEventTiming(e);
      if (!t || !onDay(t.start.toISOString(), t.end.toISOString(), selected, t.allDayLike)) continue;
      const conflicts = conflictsWithEvent(e, deviceEvents);
      out.push({
        id: `d-${e.id}`,
        title: e.title,
        start: t.start.toISOString(),
        end: t.end.toISOString(),
        allDay: t.allDayLike,
        kind: 'devfeed',
        subtitle: e.isOnline ? '온라인' : e.location ?? '장소 미정',
        event: e,
        conflict: conflicts.length ? `기존 일정 ${conflicts.length}개와 겹침` : undefined,
      });
    }

    for (const x of visibleDevice) {
      if (!onDay(x.startDate, x.endDate, selected, x.allDay)) continue;
      out.push({
        id: `g-${x.id}`,
        title: x.title,
        start: x.startDate,
        end: x.endDate,
        allDay: x.allDay,
        kind: 'device',
        subtitle: x.calendarTitle,
        calendar: x.calendarTitle,
      });
    }

    return out.sort((a, b) =>
      a.allDay === b.allDay
        ? new Date(a.start).getTime() - new Date(b.start).getTime()
        : a.allDay
          ? -1
          : 1,
    );
  }, [exactDev, visibleDevice, selected, deviceEvents]);

  const dayMarks = useMemo(() => {
    const marks = new Map<string, { devfeed: boolean; device: boolean }>();
    const mark = (key: string, kind: 'devfeed' | 'device') => {
      if (!key) return;
      const current = marks.get(key) ?? { devfeed: false, device: false };
      current[kind] = true;
      marks.set(key, current);
    };

    for (const e of exactDev) {
      const t = getEventTiming(e);
      if (!t) continue;
      for (const d of monthDays) {
        if (onDay(t.start.toISOString(), t.end.toISOString(), d, t.allDayLike)) mark(dayKey(d), 'devfeed');
      }
    }
    for (const x of visibleDevice) {
      for (const d of monthDays) {
        if (onDay(x.startDate, x.endDate, d, x.allDay)) mark(dayKey(d), 'device');
      }
    }
    return marks;
  }, [exactDev, visibleDevice, monthDays]);

  const approximate = allDev.filter((e) => approximateMatchesMonth(e, selected));
  const plannedCount = allDev.length;
  const selectedLabel = selected.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const movePeriod = (delta: number) => {
    if (viewMode === 'month') {
      const next = noon(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
      setCursor(next);
      setSelected(next);
      return;
    }
    const next = shiftDay(cursor, delta * 7);
    setCursor(next);
    setSelected(next);
  };

  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const selectDate = (d: Date) => {
    setSelected(d);
    if (viewMode === 'week') {
      setCursor(d);
      return;
    }
    if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) {
      setCursor(d);
    }
  };

  const changeMode = (mode: 'month' | 'week') => {
    setViewMode(mode);
    setCursor(selected);
  };

  return (
    <Page>
      <View style={[styles.top, compact && styles.topCompact]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>FOCUS CALENDAR</Text>
          <Text style={[styles.title, compact && { fontSize: 28 }]}>내 일정</Text>
          <Text style={styles.subtitle}>한 달을 한눈에 보고, 선택한 날은 아래 타임라인에서 자세히 확인해요.</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>•••</Text>
        </Pressable>
      </View>

      <View style={styles.viewSwitch}>
        <Pressable
          onPress={() => changeMode('month')}
          style={[styles.viewOption, viewMode === 'month' && styles.viewOptionActive]}
        >
          <Text style={[styles.viewOptionText, viewMode === 'month' && styles.viewOptionTextActive]}>월간</Text>
        </Pressable>
        <Pressable
          onPress={() => changeMode('week')}
          style={[styles.viewOption, viewMode === 'week' && styles.viewOptionActive]}
        >
          <Text style={[styles.viewOptionText, viewMode === 'week' && styles.viewOptionTextActive]}>주간</Text>
        </Pressable>
      </View>

      <View style={styles.controlRow}>
        <Pressable onPress={() => movePeriod(-1)} style={styles.navButton}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Pressable onPress={goToday} style={styles.monthButton}>
          <Text style={styles.monthText}>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</Text>
          <Text style={styles.todayHint}>오늘로 이동</Text>
        </Pressable>
        <Pressable onPress={() => movePeriod(1)} style={styles.navButton}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      {viewMode === 'month' ? (
        <View style={styles.monthCard}>
          <View style={styles.weekHeader}>
            {WEEK.map((label, i) => (
              <View key={label} style={styles.weekHeaderCell}>
                <Text style={[styles.weekHeaderText, i >= 5 && styles.weekendHeaderText]}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.monthGrid}>
            {monthDays.map((d) => {
              const key = dayKey(d);
              const active = key === dayKey(selected);
              const isToday = key === dayKey(today);
              const inMonth = d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
              const marks = dayMarks.get(key);
              const dayOfWeek = d.getDay();
              return (
                <Pressable key={key} onPress={() => selectDate(d)} style={styles.monthCell}>
                  <View
                    style={[
                      styles.dateBubble,
                      compact && styles.dateBubbleCompact,
                      active && styles.dateBubbleActive,
                      isToday && !active && styles.dateBubbleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthDate,
                        !inMonth && styles.monthDateOutside,
                        dayOfWeek === 0 && inMonth && styles.sundayText,
                        dayOfWeek === 6 && inMonth && styles.saturdayText,
                        active && styles.monthDateActive,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                    <View style={styles.markRow}>
                      {marks?.devfeed ? <View style={[styles.markDot, { backgroundColor: active ? '#fff' : colors.accent }]} /> : null}
                      {marks?.device ? <View style={[styles.markDot, { backgroundColor: active ? '#EBDCCF' : colors.orange }]} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.accent }]} /><Text style={styles.legendText}>DevFeed</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.orange }]} /><Text style={styles.legendText}>기기 일정</Text></View>
          </View>
        </View>
      ) : (
        <View style={styles.weekStrip}>
          {week.map((d, i) => {
            const active = dayKey(d) === dayKey(selected);
            const isToday = dayKey(d) === dayKey(today);
            return (
              <Pressable
                key={dayKey(d)}
                onPress={() => selectDate(d)}
                style={[styles.dayCell, active && styles.dayCellActive]}
              >
                <Text style={[styles.weekday, active && styles.weekdayActive]}>{WEEK[i]}</Text>
                <Text style={[styles.dayNumber, active && styles.dayNumberActive]}>{d.getDate()}</Text>
                {isToday ? (
                  <View style={[styles.todayDot, active && { backgroundColor: '#fff' }]} />
                ) : (
                  <View style={styles.todayDotSpace} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryNum}>{plannedCount}</Text>
          <Text style={styles.summaryLabel}>DevFeed 일정</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryNum}>{deviceEvents.length}</Text>
          <Text style={styles.summaryLabel}>기기 일정</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryNum}>{selectedItems.length}</Text>
          <Text style={styles.summaryLabel}>선택한 날</Text>
        </View>
      </View>

      {permission !== 'granted' || loadError || failedCount > 0 ? (
        <Card style={styles.connectionCard}>
          <View style={styles.connectionHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.connectionTitle}>휴대폰 캘린더</Text>
              <Text style={styles.connectionText}>
                {permission === 'granted' ? `캘린더 ${calendarCount}개 연결됨` : '기기 일정을 함께 보려면 권한이 필요해요.'}
              </Text>
            </View>
            <Badge tone={permission === 'granted' ? 'green' : 'orange'}>
              {permission === 'granted' ? '연결됨' : '연결 필요'}
            </Badge>
          </View>
          {permission === 'denied' ? (
            <View style={styles.buttonStack}>
              <Button label="캘린더 접근 허용" onPress={() => void load(true)} />
              <Button label="앱 설정 열기" variant="ghost" onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}
          {loadError ? (
            <>
              <Text style={styles.errorText}>{loadError}</Text>
              <Button label="다시 불러오기" variant="ghost" onPress={() => void load(false)} />
            </>
          ) : null}
          {failedCount > 0 ? <Text style={styles.warning}>일부 캘린더 {failedCount}개는 읽지 못했어요.</Text> : null}
        </Card>
      ) : null}

      <SectionTitle
        title={selectedLabel}
        subtitle="시간순으로 이어지는 하루 타임라인"
        right={
          <Pressable onPress={() => void load(false)}>
            <Text style={styles.refresh}>↻</Text>
          </Pressable>
        }
      />

      {(schedule.isLoading || loading) && <Loading />}

      {schedule.error ? (
        <Card>
          <Text style={styles.errorText}>DevFeed 일정을 불러오지 못했습니다.</Text>
        </Card>
      ) : null}

      {!schedule.isLoading && !loading && selectedItems.length === 0 ? (
        <View style={styles.emptyTimeline}>
          <View style={styles.emptyLine} />
          <View style={styles.emptyDot} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.emptyTitle}>비어 있는 날이에요.</Text>
            <Text style={styles.emptySub}>행사를 참가 예정으로 저장하면 여기에 나타납니다.</Text>
          </View>
        </View>
      ) : null}

      {selectedItems.length > 0 ? (
        <View style={styles.timeline}>
          {selectedItems.map((item, index) => (
            <Pressable
              key={item.id}
              disabled={!item.event}
              onPress={item.event ? () => router.push(`/event/${item.event!.id}`) : undefined}
              style={styles.timelineRow}
            >
              <View style={[styles.timeColumn, compact && { width: 45 }]}>
                <Text style={styles.time}>{timeText(item.start, item.allDay)}</Text>
                <Text style={styles.duration}>{durationText(item.start, item.end, item.allDay)}</Text>
              </View>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.railDot,
                    { backgroundColor: item.kind === 'devfeed' ? colors.accent : colors.orange },
                  ]}
                />
                {index < selectedItems.length - 1 ? <View style={styles.railLine} /> : null}
              </View>
              <View style={[styles.eventBlock, item.kind === 'devfeed' ? styles.devBlock : styles.deviceBlock]}>
                <View style={styles.blockTop}>
                  <Badge tone={item.kind === 'devfeed' ? 'purple' : 'orange'}>
                    {item.kind === 'devfeed' ? 'DevFeed' : item.calendar ?? '기기'}
                  </Badge>
                  {item.conflict ? <Badge tone="red">충돌</Badge> : null}
                </View>
                <Text style={styles.blockTitle}>{item.title}</Text>
                <Text style={styles.blockSub}>
                  {item.subtitle}
                  {item.conflict ? ` · ${item.conflict}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {approximate.length > 0 ? (
        <>
          <SectionTitle
            title={`${selected.getMonth() + 1}월 · 날짜 미정`}
            subtitle="정확한 날짜가 공개되기 전에는 타임라인에 억지로 배치하지 않아요."
          />
          <View style={styles.unscheduled}>
            {approximate.map((e) => (
              <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={styles.unscheduledRow}>
                <View style={styles.unscheduledMark} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.unscheduledTitle}>{e.title}</Text>
                  <Text style={styles.unscheduledSub}>
                    {eventDateLabel(e)} · {e.categories.slice(0, 2).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.arrow}>↗</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  topCompact: { gap: 8 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 5 },
  title: { color: colors.text, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5, maxWidth: 350 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconButtonText: { color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  viewSwitch: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: 'flex-start',
  },
  viewOption: { minWidth: 64, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  viewOptionActive: { backgroundColor: colors.accent },
  viewOptionText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  viewOptionTextActive: { color: '#fff' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { color: colors.text, fontSize: 27, lineHeight: 30, fontWeight: '500' },
  monthButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  todayHint: { color: colors.muted2, fontSize: 9, fontWeight: '700', marginTop: 2 },
  monthCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 12,
  },
  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  weekHeaderCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
  weekHeaderText: { color: colors.muted2, fontSize: 10, fontWeight: '900' },
  weekendHeaderText: { color: colors.muted },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '14.2857%', alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dateBubble: {
    width: '86%',
    maxWidth: 45,
    minWidth: 34,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBubbleCompact: { minWidth: 30, height: 42, borderRadius: 14 },
  dateBubbleActive: { backgroundColor: colors.accent },
  dateBubbleToday: { borderWidth: 1.5, borderColor: colors.accent },
  monthDate: { color: colors.text, fontSize: 14, fontWeight: '900' },
  monthDateOutside: { color: colors.muted2, opacity: 0.45 },
  sundayText: { color: '#E35D6A' },
  saturdayText: { color: '#5870D8' },
  monthDateActive: { color: '#fff' },
  markRow: { height: 7, marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  markDot: { width: 4, height: 4, borderRadius: 2 },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 6, marginTop: 7 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  weekStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 5,
    gap: 2,
  },
  dayCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 9, borderRadius: 15 },
  dayCellActive: { backgroundColor: colors.accent },
  weekday: { color: colors.muted2, fontSize: 9, fontWeight: '800' },
  weekdayActive: { color: '#E9E1FF' },
  dayNumber: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 4 },
  dayNumberActive: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginTop: 5 },
  todayDotSpace: { width: 4, height: 4, marginTop: 5 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  summaryNum: { color: colors.text, fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  connectionCard: { gap: 12 },
  connectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  connectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  connectionText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  buttonStack: { gap: 8 },
  errorText: { color: colors.red, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  warning: { color: colors.orange, fontSize: 11, fontWeight: '800' },
  refresh: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  emptyTimeline: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  emptyLine: { width: 1, height: 70, backgroundColor: colors.line, marginLeft: 14 },
  emptyDot: { position: 'absolute', left: 26, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lineStrong },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  emptySub: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  timeline: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 12, minHeight: 92 },
  timeColumn: { width: 52, paddingTop: 12, alignItems: 'flex-start' },
  time: { color: colors.text, fontSize: 11, fontWeight: '900' },
  duration: { color: colors.muted2, fontSize: 9, fontWeight: '700', marginTop: 4 },
  rail: { width: 18, alignItems: 'center' },
  railDot: { width: 8, height: 8, borderRadius: 4, marginTop: 17, zIndex: 2 },
  railLine: { position: 'absolute', top: 25, bottom: -1, width: 1, backgroundColor: colors.lineStrong },
  eventBlock: {
    flex: 1,
    minWidth: 0,
    marginVertical: 6,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
  },
  devBlock: { backgroundColor: '#F4F0FF', borderColor: '#E4DAFF' },
  deviceBlock: { backgroundColor: '#FFF4EA', borderColor: '#F3DDCA' },
  blockTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  blockTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '900', marginTop: 8 },
  blockSub: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  unscheduled: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  unscheduledRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  unscheduledMark: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  unscheduledTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  unscheduledSub: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  arrow: { color: colors.accent, fontSize: 16, fontWeight: '900' },
});
