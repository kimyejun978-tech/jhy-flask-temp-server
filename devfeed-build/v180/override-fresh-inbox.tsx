import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Page, SectionTitle } from '@/components/Ui';
import { clearFreshHistory, markAllFreshRead, markFreshRead, useFreshInbox, type FreshKind } from '@/freshness';
import { colors, radius } from '@/theme';

const LABEL: Record<FreshKind, string> = {
  event: '행사',
  trend: '트렌드',
  news: 'AI 뉴스',
};

function timeText(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '최근';
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function FreshInboxScreen() {
  const inbox = useFreshInbox();

  const open = async (kind: FreshKind, itemId: string, route: string) => {
    await markFreshRead(kind, itemId);
    router.push(route as never);
  };

  const clear = () => {
    void clearFreshHistory();
  };

  return (
    <Page style={{ paddingBottom: 56 }}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>닫기</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>FRESH INBOX</Text>
          <Text style={styles.title}>새 소식</Text>
          <Text style={styles.subtitle}>DevFeed가 새로 발견한 행사, 글, AI 뉴스를 시간순으로 기록해요.</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <View><Text style={styles.summaryNumber}>{inbox.unreadCount}</Text><Text style={styles.summaryLabel}>읽지 않음</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryNumber}>{inbox.items.length}</Text><Text style={styles.summaryLabel}>최근 기록</Text></View>
      </View>

      {inbox.unreadCount > 0 ? <Button label="모두 읽음으로 표시" variant="secondary" onPress={() => void markAllFreshRead()} /> : null}

      <SectionTitle title="알림 기록" subtitle="새로 수집된 순서대로 보여줍니다." />
      {inbox.items.length === 0 ? (
        <Card><Text style={styles.empty}>아직 새로 발견한 정보가 없어요. 다음 수집부터 여기에 기록됩니다.</Text></Card>
      ) : (
        <View style={styles.list}>
          {inbox.items.map(item => (
            <Pressable key={item.key} onPress={() => void open(item.kind, item.itemId, item.route)} style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && { opacity: 0.62 }]}>
              <View style={[styles.icon, !item.read && styles.iconUnread]}><Text style={styles.iconText}>{item.kind === 'event' ? '◇' : item.kind === 'trend' ? '↗' : 'AI'}</Text></View>
              <View style={styles.body}>
                <View style={styles.metaRow}>
                  <Badge tone={item.read ? 'neutral' : 'purple'}>{item.read ? LABEL[item.kind] : 'NEW'}</Badge>
                  <Text style={styles.time}>{timeText(item.detectedAt)}</Text>
                </View>
                <Text numberOfLines={2} style={[styles.itemTitle, !item.read && styles.itemTitleUnread]}>{item.title}</Text>
                <Text style={styles.kind}>{LABEL[item.kind]}</Text>
              </View>
              <Text style={styles.arrow}>↗</Text>
            </Pressable>
          ))}
        </View>
      )}

      {inbox.items.length > 0 ? <Button label="기록 비우기" variant="ghost" onPress={clear} /> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  back: { minWidth: 48, minHeight: 46, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6F46D9', borderRadius: radius.lg, padding: 18 },
  summaryNumber: { color: colors.white, fontSize: 26, fontWeight: '900' },
  summaryLabel: { color: '#E4DBFA', fontSize: 11, fontWeight: '800', marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#FFFFFF35', marginHorizontal: 24 },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 11, padding: 14, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowUnread: { backgroundColor: '#FAF8FF' },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconUnread: { backgroundColor: colors.accentSoft },
  iconText: { color: colors.accentDark, fontSize: 12, fontWeight: '900' },
  body: { flex: 1, minWidth: 0, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { color: colors.muted2, fontSize: 10, fontWeight: '700' },
  itemTitle: { color: '#55535E', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  itemTitleUnread: { color: colors.text, fontWeight: '900' },
  kind: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  arrow: { color: colors.accent, fontSize: 16, fontWeight: '900' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
