import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, Card, ErrorBox, Loading, Page, SectionTitle, ui } from '@/components/Ui';
import { useEvents, useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors, radius } from '@/theme';
import { eventDateLabel, eventPrecision } from '@/calendar';

const FILTERS = ['전체', 'AI', '로봇', '임베디드', 'SW', '해커톤'];

function localBoundary(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    return endOfDay
      ? new Date(y, m, d, 23, 59, 59, 999)
      : new Date(y, m, d, 0, 0, 0, 0);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function deadlineEnd(deadline: string | null | undefined) {
  return localBoundary(deadline, true);
}

function isDeadlineClosed(event: EventItem) {
  const end = deadlineEnd(event.deadline);
  return Boolean(end && end.getTime() < Date.now());
}

function isEventEnded(event: EventItem) {
  if (eventPrecision(event) !== 'EXACT' || !event.startDate) return false;

  const explicitEnd = localBoundary(event.endDate, true);
  if (explicitEnd) return explicitEnd.getTime() < Date.now();

  const startRaw = String(event.startDate).trim();
  const start = localBoundary(event.startDate, /^\d{4}-\d{2}-\d{2}$/.test(startRaw));
  if (!start) return false;

  const assumedEnd = /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
    ? start
    : new Date(start.getTime() + 6 * 60 * 60 * 1000);
  return assumedEnd.getTime() < Date.now();
}

function isActionable(event: EventItem) {
  return !isEventEnded(event) && !isDeadlineClosed(event);
}

function dday(deadline: string | null) {
  if (!deadline) return null;
  const end = deadlineEnd(deadline);
  if (!end) return null;
  const diff = end.getTime() - Date.now();
  if (diff < 0) return '마감';
  const d = Math.ceil(diff / 86400000);
  if (d <= 1) return '오늘 마감';
  return `D-${d - 1}`;
}

function statusLabel(status: EventItem['userStatus']) {
  if (status === 'INTERESTED') return '관심';
  if (status === 'PLANNING') return '참가 예정';
  if (status === 'APPLIED') return '신청 완료';
  if (status === 'COMPLETED') return '완료';
  return null;
}

function EventRow({ event, compact }: { event: EventItem; compact: boolean }) {
  const deadline = dday(event.deadline);
  const status = statusLabel(event.userStatus);
  const approximate = eventPrecision(event) !== 'EXACT';
  return (
    <Pressable onPress={() => router.push(`/event/${event.id}`)} style={({ pressed }) => [styles.eventRow, compact && styles.eventRowCompact, pressed && { opacity: 0.62 }]}>
      <View style={[styles.dateTile, compact && styles.dateTileCompact]}>
        <Text style={styles.dateMonth}>{event.startDate ? `${new Date(event.startDate).getMonth() + 1}월` : 'DATE'}</Text>
        <Text style={[styles.dateDay, compact && { fontSize: 21 }]}>{event.startDate ? String(new Date(event.startDate).getDate()) : '—'}</Text>
      </View>
      <View style={styles.eventBody}>
        <View style={styles.eventTopLine}>
          <View style={styles.tagLine}>{event.categories.slice(0, compact ? 1 : 2).map(c => <Badge key={c} tone="purple">{c}</Badge>)}</View>
          {deadline ? <Text style={[styles.deadline, event.importance === 'HIGH' && { color: colors.red }]}>{deadline}</Text> : null}
        </View>
        <Text style={[styles.eventTitle, compact && { fontSize: 15, lineHeight: 21 }]}>{event.title}</Text>
        <Text style={styles.eventMeta}>{eventDateLabel(event)}{approximate ? ' · 날짜 미정' : ''} · {event.isOnline ? '온라인' : event.location ?? '장소 확인 필요'}</Text>
        <View style={styles.eventBottomLine}>
          <Text numberOfLines={compact ? 1 : 2} style={styles.eventSummary}>{event.summary ?? '공식 상세에서 내용을 확인할 수 있어요.'}</Text>
          {status ? <Badge tone="green">{status}</Badge> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function EventsScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const [filter, setFilter] = useState('전체');
  const events = useEvents();
  const schedule = useSchedule();
  const all = events.data?.items ?? [];
  const active = useMemo(() => all.filter(isActionable), [all]);
  const filtered = useMemo(() => active.filter(e => filter === '전체' || e.categories.some(c => c.toLowerCase().includes(filter.toLowerCase()) || filter.toLowerCase().includes(c.toLowerCase()))), [active, filter]);
  const urgent = active.filter(e => e.deadline && dday(e.deadline) && dday(e.deadline) !== '마감').sort((a, b) => (deadlineEnd(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (deadlineEnd(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER)).slice(0, 3);
  const planning = schedule.data?.items ?? [];
  const featured = filtered.filter(e => e.importance === 'HIGH').slice(0, 4);
  const rest = filtered.filter(e => !featured.some(x => x.id === e.id));

  return (
    <Page style={{ paddingTop: 10 }}>
      <View style={[styles.workspaceHero, compact && styles.workspaceHeroCompact]}>
        <View style={styles.heroOrbOne} />
        <View style={styles.heroOrbTwo} />
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>DEVFEED WORKSPACE</Text>
            <Text style={[styles.heroTitle, compact && { fontSize: 27, lineHeight: 33 }]}>이번 주의{`\n`}기회를 정리했어요.</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}><Text style={styles.settingsButtonText}>설정</Text></Pressable>
        </View>
        <Text style={styles.heroSubtitle}>공모전, 컨퍼런스, 해커톤을 훑고 참가할 것만 일정에 남겨보세요.</Text>
        <View style={styles.heroStats}>
          <Pressable onPress={() => router.push('/schedule')} style={styles.heroStat}><Text style={styles.heroStatNumber}>{planning.length}</Text><Text style={styles.heroStatLabel}>참가 일정</Text></Pressable>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}><Text style={styles.heroStatNumber}>{urgent.length}</Text><Text style={styles.heroStatLabel}>마감 임박</Text></View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}><Text style={styles.heroStatNumber}>{active.length}</Text><Text style={styles.heroStatLabel}>진행 중</Text></View>
        </View>
      </View>

      {urgent.length > 0 ? (
        <Card style={styles.agendaCard}>
          <SectionTitle title="곧 마감돼요" subtitle="신청을 미루기 전에 먼저 볼 항목" right={<Text style={styles.smallArrow}>→</Text>} />
          {urgent.map((e, i) => (
            <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={styles.agendaRow}>
              <View style={styles.agendaIndex}><Text style={styles.agendaIndexText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.agendaTitle}>{e.title}</Text><Text style={styles.agendaMeta}>{dday(e.deadline)} · {e.categories[0] ?? '행사'}</Text></View>
              <Text style={styles.smallArrow}>↗</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map(item => {
          const activeFilter = filter === item;
          return <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, activeFilter && styles.filterChipActive]}><Text style={[styles.filterText, activeFilter && styles.filterTextActive]}>{item}</Text></Pressable>;
        })}
      </View>

      <SectionTitle title={filter === '전체' ? '추천 행사' : `${filter}에서 볼 것`} subtitle="이미 종료되거나 신청이 마감된 행사는 자동으로 제외해요." right={!events.isLoading ? <Text style={styles.countText}>{filtered.length}</Text> : undefined} />
      {events.isLoading && <Loading />}
      {events.error && <ErrorBox message={events.error.message} />}
      {!events.isLoading && !events.error && filtered.length === 0 ? <Card><Text style={ui.muted}>지금 참가할 수 있는 행사가 아직 없어요.</Text></Card> : null}

      {featured.length > 0 ? <View style={styles.featuredWrap}>{featured.map(e => <EventRow compact={compact} key={`featured-${e.id}`} event={e} />)}</View> : null}
      {rest.length > 0 ? <SectionTitle title="전체 목록" subtitle="현재 참가 가능한 항목을 이어서 봅니다." /> : null}
      {rest.length > 0 ? <View style={styles.listWrap}>{rest.map(e => <EventRow compact={compact} key={e.id} event={e} />)}</View> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  workspaceHero: { position: 'relative', overflow: 'hidden', backgroundColor: '#6F46D9', borderRadius: 28, padding: 20, minHeight: 250 },
  workspaceHeroCompact: { minHeight: 238, padding: 17, borderRadius: 24 },
  heroOrbOne: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -80, backgroundColor: '#B95CCB', opacity: 0.65 },
  heroOrbTwo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, left: -70, bottom: -100, backgroundColor: '#8E68F5', opacity: 0.8 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  heroEyebrow: { color: '#E7DDFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 7 },
  heroTitle: { color: colors.white, fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -1.1 },
  heroSubtitle: { color: '#E8E0FA', fontSize: 13, lineHeight: 20, fontWeight: '600', marginTop: 12, maxWidth: 305 },
  settingsButton: { backgroundColor: '#FFFFFF26', borderWidth: 1, borderColor: '#FFFFFF35', paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, flexShrink: 0 },
  settingsButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  heroStats: { marginTop: 'auto', paddingTop: 24, flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, gap: 3, minWidth: 0 },
  heroStatNumber: { color: colors.white, fontSize: 23, fontWeight: '900' },
  heroStatLabel: { color: '#DDD3F5', fontSize: 11, fontWeight: '700' },
  heroStatDivider: { width: 1, height: 34, backgroundColor: '#FFFFFF2D', marginHorizontal: 8 },
  agendaCard: { paddingVertical: 14 },
  agendaRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11, marginTop: 2 },
  agendaIndex: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  agendaIndexText: { color: colors.accentDark, fontSize: 12, fontWeight: '900' },
  agendaTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  agendaMeta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  smallArrow: { color: colors.muted, fontSize: 17, fontWeight: '700', flexShrink: 0 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  filterChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  countText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  featuredWrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  listWrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  eventRow: { flexDirection: 'row', gap: 13, padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  eventRowCompact: { paddingHorizontal: 12, gap: 10 },
  dateTile: { width: 50, height: 58, borderRadius: 14, backgroundColor: colors.accentSoft2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dateTileCompact: { width: 44, height: 54 },
  dateMonth: { color: colors.accentDark, fontSize: 9, fontWeight: '900' },
  dateDay: { color: colors.accentDark, fontSize: 24, lineHeight: 27, fontWeight: '900' },
  eventBody: { flex: 1, minWidth: 0, gap: 6 },
  eventTopLine: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', alignItems: 'center' },
  tagLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1, minWidth: 0 },
  deadline: { color: colors.muted, fontSize: 11, fontWeight: '900', flexShrink: 0 },
  eventTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '900', letterSpacing: -0.35 },
  eventMeta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  eventBottomLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  eventSummary: { color: '#5F5F6B', fontSize: 12, lineHeight: 18, flex: 1, minWidth: 0 },
});
