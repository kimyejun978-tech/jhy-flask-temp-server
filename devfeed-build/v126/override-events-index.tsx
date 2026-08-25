import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';
import { useEvents, useSchedule } from '@/api/hooks';
import type { EventItem } from '@/types';
import { colors } from '@/theme';
import { eventDateLabel, eventPrecision } from '@/calendar';

const FILTERS = ['전체', 'AI', '로봇', '임베디드', 'SW', '해커톤'];

function dday(deadline: string | null) {
  if (!deadline) return '';
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (d < 0) return '마감';
  if (d === 0) return 'D-DAY';
  return `D-${d}`;
}

function meta(e: EventItem) {
  const out: string[] = [];
  if (e.isOnline) out.push('온라인');
  else if (e.location) out.push(e.location);
  if (e.fee === 0) out.push('무료');
  if (e.highSchoolAllowed === true) out.push('고등학생 가능');
  return out;
}

function statusLabel(value: EventItem['userStatus']) {
  if (value === 'INTERESTED') return '관심';
  if (value === 'PLANNING') return '참가 예정';
  if (value === 'APPLIED') return '신청 완료';
  if (value === 'DONE') return '완료';
  return '';
}

function EventCard({ e }: { e: EventItem }) {
  const approximate = eventPrecision(e) !== 'EXACT';
  const countdown = dday(e.deadline);
  const status = statusLabel(e.userStatus);
  return (
    <Card onPress={() => router.push(`/event/${e.id}`)}>
      <View style={styles.cardTopRow}>
        <View style={styles.categoryRow}>
          {e.categories.slice(0, 2).map((c) => <Badge key={c}>{c}</Badge>)}
        </View>
        {countdown ? (
          <View style={[styles.dday, e.importance === 'HIGH' && styles.ddayHot]}>
            <Text style={[styles.ddayText, e.importance === 'HIGH' && { color: '#FFD4D9' }]}>{countdown}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.eventTitle}>{e.title}</Text>
      <View style={styles.dateRow}>
        <View style={styles.dateMark} />
        <Text style={styles.dateText}>{eventDateLabel(e)}{approximate ? ' · 날짜 미정' : ''}</Text>
      </View>
      <Text style={styles.metaText}>{meta(e).join('  ·  ') || '공식 상세에서 확인'}</Text>
      {e.summary ? <Text numberOfLines={2} style={styles.summary}>{e.summary}</Text> : null}
      {status ? (
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function EventsScreen() {
  const [category, setCategory] = useState('전체');
  const all = useEvents();
  const schedule = useSchedule();
  const allItems = all.data?.items ?? [];
  const items = allItems.filter((e) => category === '전체' || e.categories.some((c) => c.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(c.toLowerCase())));
  const hotCount = allItems.filter((x) => x.importance === 'HIGH').length;
  const scheduleCount = schedule.data?.items.length ?? 0;

  return (
    <Page>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DEVFEED</Text>
          <Text style={styles.heroTitle}>놓치기 전에,{`\n`}지금 볼 것.</Text>
          <Text style={styles.heroSub}>개발 행사, 트렌드와 일정을 한 번에 정리했어요.</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}>
          <Text style={styles.settingsText}>설정</Text>
        </Pressable>
      </View>

      <Card onPress={() => router.push('/schedule')} style={styles.briefCard}>
        <View style={styles.briefHead}>
          <View>
            <Text style={styles.briefEyebrow}>TODAY</Text>
            <Text style={styles.briefTitle}>오늘의 브리핑</Text>
          </View>
          <Text style={styles.briefArrow}>↗</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{hotCount}</Text>
            <Text style={styles.statLabel}>추천 행사</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{scheduleCount}</Text>
            <Text style={styles.statLabel}>참가 일정</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{allItems.length}</Text>
            <Text style={styles.statLabel}>수집 행사</Text>
          </View>
        </View>
      </Card>

      <View style={styles.filterWrap}>
        {FILTERS.map((x) => {
          const active = category === x;
          return (
            <Pressable key={x} onPress={() => setCategory(x)} style={[styles.filter, active && styles.filterActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{x}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionEyebrow}>CURATED</Text>
          <Text style={ui.h2}>{category === '전체' ? '지금 주목할 행사' : `${category} 행사`}</Text>
        </View>
        {!all.isLoading ? <Text style={styles.count}>{items.length}개</Text> : null}
      </View>

      {all.isLoading && <Loading />}
      {all.error && <ErrorBox message={all.error.message} />}
      {!all.isLoading && !all.error && items.length === 0 ? (
        <Card><Text style={ui.muted}>이 필터에 맞는 행사가 아직 없습니다.</Text></Card>
      ) : null}
      {items.map((e) => <EventCard key={e.id} e={e} />)}
    </Page>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 4, paddingBottom: 6 },
  brand: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2.1, marginBottom: 8 },
  heroTitle: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1.4 },
  heroSub: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 9, maxWidth: 290 },
  settingsButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  settingsText: { color: '#C9D0DB', fontSize: 12, fontWeight: '800' },
  briefCard: { backgroundColor: '#111A2A', borderColor: '#263A63', padding: 18 },
  briefHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  briefEyebrow: { color: '#8CA7FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  briefTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  briefArrow: { color: '#AFC0FF', fontSize: 22, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statBox: { flex: 1, gap: 2 },
  statNumber: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  statLabel: { color: '#8D9AAF', fontSize: 11, fontWeight: '700' },
  statDivider: { width: 1, height: 32, backgroundColor: '#2A3952', marginHorizontal: 10 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  filterActive: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { color: '#9CA6B5', fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: colors.bg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 5 },
  sectionEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 2 },
  count: { color: colors.muted, fontSize: 12, fontWeight: '800', paddingBottom: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  dday: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#242B36' },
  ddayHot: { backgroundColor: '#3B1D25', borderWidth: 1, borderColor: '#63313C' },
  ddayText: { color: '#B6BECA', fontSize: 10, fontWeight: '900' },
  eventTitle: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: '900', letterSpacing: -0.45 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateMark: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  dateText: { color: '#DDE4F1', fontSize: 13, fontWeight: '800' },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  summary: { color: '#C7CED8', fontSize: 14, lineHeight: 21, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  statusText: { color: colors.green, fontSize: 12, fontWeight: '900' },
});
