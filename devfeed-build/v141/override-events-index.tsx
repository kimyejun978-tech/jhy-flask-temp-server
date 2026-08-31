import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, Button, Card, ErrorBox, Loading, Page, SectionTitle, ui } from '@/components/Ui';
import { useEvents, useSchedule, useSetAnyEventStatus } from '@/api/hooks';
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
  if (d <= 1) return '신청 오늘 마감';
  return `신청 D-${d - 1}`;
}

function normalizedTitle(title: string) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function dedupeEvents(events: EventItem[]) {
  const byTitle = new Map<string, EventItem>();
  for (const event of events) {
    const key = normalizedTitle(event.title);
    const current = byTitle.get(key);
    if (!current) { byTitle.set(key, event); continue; }
    const currentScore = Number(eventPrecision(current) === 'EXACT') * 2 + Number(Boolean(current.startDate)) + Number(Boolean(current.location));
    const nextScore = Number(eventPrecision(event) === 'EXACT') * 2 + Number(Boolean(event.startDate)) + Number(Boolean(event.location));
    if (nextScore > currentScore) byTitle.set(key, event);
  }
  return [...byTitle.values()];
}

function statusLabel(status: EventItem['userStatus']) {
  if (status === 'INTERESTED') return '관심';
  if (status === 'PLANNING') return '참가 예정';
  if (status === 'APPLIED') return '신청 완료';
  if (status === 'COMPLETED') return '완료';
  return null;
}

function EventRow({ event, compact, onMarkInterested }: { event: EventItem; compact: boolean; onMarkInterested: (event: EventItem) => void }) {
  const deadline = dday(event.deadline);
  const status = statusLabel(event.userStatus);
  const approximate = eventPrecision(event) !== 'EXACT';
  return (
    <View style={[styles.eventRow, compact && styles.eventRowCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${event.title} 상세 보기`} onPress={() => router.push(`/event/${event.id}`)} style={({ pressed }) => [styles.eventMain, pressed && { opacity: 0.62 }]}>
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
      {event.userStatus === 'NONE' ? <Pressable accessibilityRole="button" accessibilityLabel={`${event.title} 관심 저장`} onPress={() => onMarkInterested(event)} style={({ pressed }) => [styles.interestButton, pressed && { opacity: 0.62 }]}><Text style={styles.interestButtonText}>관심 저장</Text></Pressable> : null}
    </View>
  );
}

export default function EventsScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const [filter, setFilter] = useState('전체');
  const [showAll, setShowAll] = useState(false);
  const events = useEvents();
  const schedule = useSchedule();
  const statusMutation = useSetAnyEventStatus();
  const all = useMemo(() => dedupeEvents(events.data?.items ?? []), [events.data?.items]);
  const active = useMemo(() => all.filter(isActionable), [all]);
  const filtered = useMemo(() => active.filter(e => filter === '전체' || e.categories.some(c => c.toLowerCase().includes(filter.toLowerCase()) || filter.toLowerCase().includes(c.toLowerCase()))), [active, filter]);
  const urgent = active.filter(e => e.deadline && dday(e.deadline) && dday(e.deadline) !== '마감').sort((a, b) => (deadlineEnd(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (deadlineEnd(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER)).slice(0, 3);
  const planning = schedule.data?.items ?? [];
  const interested = active.filter(e => e.userStatus === 'INTERESTED');
  const featured = filtered.filter(e => e.importance === 'HIGH').slice(0, 4);
  const rest = filtered.filter(e => !featured.some(x => x.id === e.id));
  const visibleRest = showAll ? rest : rest.slice(0, 6);
  const focus = urgent[0] ?? filtered[0];
  const saveInterest = (event: EventItem) => statusMutation.mutate({ id: event.id, status: 'INTERESTED' });

  return (
    <Page style={{ paddingTop: 10 }}>
      <View style={[styles.workspaceHero, compact && styles.workspaceHeroCompact]}>
        <View style={styles.heroOrbOne} />
        <View style={styles.heroOrbTwo} />
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>DEVFEED WORKSPACE</Text>
            <Text style={[styles.heroTitle, compact && { fontSize: 27, lineHeight: 33 }]}>{planning.length ? '이번 주 할 일을\n정리했어요.' : '이번 주, 하나만\n골라볼까요?'}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}><Text style={styles.settingsButtonText}>설정</Text></Pressable>
        </View>
        <Text style={styles.heroSubtitle}>{planning.length ? '저장한 일정과 신청 마감부터 확인해보세요.' : '관심 있는 행사 하나를 저장하면 다음에 바로 이어서 볼 수 있어요.'}</Text>
        <View style={styles.heroStats}>
          <Pressable onPress={() => router.push('/schedule')} style={styles.heroStat}><Text style={styles.heroStatNumber}>{planning.length}</Text><Text style={styles.heroStatLabel}>참가 일정</Text></Pressable>
          <View style={styles.heroStatDivider} />
          <Pressable onPress={() => router.push('/settings')} style={styles.heroStat}><Text style={styles.heroStatNumber}>{interested.length}</Text><Text style={styles.heroStatLabel}>관심 저장</Text></Pressable>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}><Text style={styles.heroStatNumber}>{urgent.length}</Text><Text style={styles.heroStatLabel}>마감 임박</Text></View>
        </View>
      </View>

      {focus ? <Card style={styles.focusCard}>
        <View style={styles.focusTop}><Badge tone="orange">지금 볼 행사</Badge>{dday(focus.deadline) ? <Text style={styles.focusDeadline}>{dday(focus.deadline)}</Text> : null}</View>
        <Text style={styles.focusTitle}>{focus.title}</Text>
        <Text style={styles.focusMeta}>{eventDateLabel(focus)} · {focus.isOnline ? '온라인' : focus.location ?? '장소 확인 필요'}</Text>
        <View style={styles.focusActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/event/${focus.id}`)} style={({ pressed }) => [styles.focusSecondary, pressed && { opacity: 0.62 }]}><Text style={styles.focusSecondaryText}>내용 보기</Text></Pressable>
          {focus.userStatus === 'NONE' ? <Pressable accessibilityRole="button" accessibilityState={{ busy: statusMutation.isPending }} disabled={statusMutation.isPending} onPress={() => saveInterest(focus)} style={({ pressed }) => [styles.focusPrimary, (pressed || statusMutation.isPending) && { opacity: 0.62 }]}><Text style={styles.focusPrimaryText}>{statusMutation.isPending ? '저장 중…' : '관심 저장'}</Text></Pressable> : focus.userStatus === 'INTERESTED' ? <View style={styles.focusSaved}><Text style={styles.focusSavedText}>관심에 저장됨</Text></View> : <Pressable accessibilityRole="button" onPress={() => router.push('/schedule')} style={({ pressed }) => [styles.focusPrimary, pressed && { opacity: 0.62 }]}><Text style={styles.focusPrimaryText}>내 일정 보기</Text></Pressable>}
        </View>
      </Card> : null}

      {interested.length > 0 ? <>
        <SectionTitle title="내가 저장한 행사" subtitle="관심으로 남긴 항목부터 이어서 확인하세요." right={<Text style={styles.countText}>{interested.length}</Text>} />
        <View style={styles.featuredWrap}>{interested.slice(0, 3).map(e => <EventRow compact={compact} key={`interest-${e.id}`} event={e} onMarkInterested={saveInterest} />)}</View>
      </> : null}

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
          return <Pressable key={item} onPress={() => { setFilter(item); setShowAll(false); }} style={[styles.filterChip, activeFilter && styles.filterChipActive]}><Text style={[styles.filterText, activeFilter && styles.filterTextActive]}>{item}</Text></Pressable>;
        })}
      </View>

      <SectionTitle title={filter === '전체' ? '추천 행사' : `${filter}에서 볼 것`} subtitle="이미 종료되거나 신청이 마감된 행사는 자동으로 제외해요." right={!events.isLoading ? <Text style={styles.countText}>{filtered.length}</Text> : undefined} />
      {events.isLoading && <Loading />}
      {events.error && <ErrorBox message={events.error.message} />}
      {!events.isLoading && !events.error && filtered.length === 0 ? <Card><Text style={ui.muted}>지금 참가할 수 있는 행사가 아직 없어요.</Text></Card> : null}

      {featured.length > 0 ? <View style={styles.featuredWrap}>{featured.map(e => <EventRow compact={compact} key={`featured-${e.id}`} event={e} onMarkInterested={saveInterest} />)}</View> : null}
      {rest.length > 0 ? <SectionTitle title="더 찾아보기" subtitle={showAll ? '현재 참가 가능한 항목입니다.' : '지금은 여섯 개만 보여드려요.'} right={<Text style={styles.countText}>{rest.length}</Text>} /> : null}
      {visibleRest.length > 0 ? <View style={styles.listWrap}>{visibleRest.map(e => <EventRow compact={compact} key={e.id} event={e} onMarkInterested={saveInterest} />)}</View> : null}
      {!showAll && rest.length > visibleRest.length ? <Button label={`행사 ${rest.length - visibleRest.length}개 더 보기`} variant="secondary" onPress={() => setShowAll(true)} /> : null}
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
  focusCard: { backgroundColor: '#F5F1FF', borderColor: '#E4D9FF', gap: 9 },
  focusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  focusDeadline: { color: colors.red, fontSize: 12, fontWeight: '900' },
  focusTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35 },
  focusMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  focusActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  focusPrimary: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  focusPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  focusSecondary: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  focusSecondaryText: { color: colors.accentDark, fontSize: 13, fontWeight: '900' },
  focusSaved: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#E8F7F0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  focusSavedText: { color: colors.green, fontSize: 13, fontWeight: '900' },
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
  eventRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  eventRowCompact: { paddingHorizontal: 12, gap: 10 },
  eventMain: { flexDirection: 'row', gap: 13, padding: 15 },
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
  interestButton: { alignSelf: 'flex-start', marginHorizontal: 15, marginTop: -4, marginBottom: 14, paddingHorizontal: 11, minHeight: 32, borderRadius: radius.pill, backgroundColor: colors.accentSoft, justifyContent: 'center' },
  interestButtonText: { color: colors.accentDark, fontSize: 11, fontWeight: '900' },
});
