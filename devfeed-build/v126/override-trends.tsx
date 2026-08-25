import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';
import { useTrends } from '@/api/hooks';
import type { TrendItem } from '@/types';
import { colors } from '@/theme';

const CATEGORIES = ['전체','AI','백엔드','프론트엔드','모바일','클라우드/DevOps','임베디드/IoT','보안','데이터','CS/아키텍처','언어/개발도구'] as const;
type Category = typeof CATEGORIES[number];

const RULES: Array<[Exclude<Category,'전체'>, RegExp]> = [
  ['AI', /(?:\bAI\b|인공지능|LLM|GPT|ChatGPT|OpenAI|Claude|Gemini|MCP|RAG|LangChain|에이전트|Agent|머신러닝|딥러닝|생성형)/i],
  ['백엔드', /(?:백엔드|Backend|Spring|NestJS|Node\.?js|Express|FastAPI|Django|Flask|REST|GraphQL|API|서버|PostgreSQL|MySQL|MongoDB|Redis|Database|DB\b)/i],
  ['프론트엔드', /(?:프론트엔드|Frontend|React|Next\.?js|Vue|Svelte|Angular|JavaScript|TypeScript|HTML|CSS|브라우저|웹\s*개발)/i],
  ['모바일', /(?:Android|iOS|Flutter|React Native|Expo|Kotlin|Swift|모바일|앱\s*개발)/i],
  ['클라우드/DevOps', /(?:Cloud|클라우드|AWS|GCP|Azure|Cloudflare|Docker|Kubernetes|K8s|DevOps|CI\/?CD|GitHub Actions|Terraform|Nginx|배포|인프라)/i],
  ['임베디드/IoT', /(?:임베디드|Embedded|IoT|ESP32|Arduino|아두이노|Raspberry\s*Pi|라즈베리파이|STM32|MCU|펌웨어|Firmware|RTOS|GPIO|센서)/i],
  ['보안', /(?:보안|Security|취약점|CTF|OAuth|JWT|인증|암호화|XSS|CSRF|SQL Injection|해킹)/i],
  ['데이터', /(?:데이터|Data|Pandas|NumPy|Spark|Kafka|ETL|데이터베이스|SQL|분석|Analytics|파이프라인)/i],
  ['CS/아키텍처', /(?:자료구조|알고리즘|운영체제|OS\b|네트워크|TCP|UDP|HTTP|컴퓨터구조|동시성|스레드|프로세스|아키텍처|Architecture|Design Pattern|디자인\s*패턴|분산\s*시스템)/i],
  ['언어/개발도구', /(?:Rust|C\+\+|C언어|Python|Java\b|Go\b|Golang|Git\b|GitHub|VS\s*Code|Cursor|IDE|CLI|패키지|라이브러리|프레임워크)/i],
];

function categoriesOf(item: TrendItem): string[] {
  if (Array.isArray(item.categories) && item.categories.length) return item.categories;
  const text = `${item.title} ${item.tags.join(' ')} ${item.summary ?? ''}`;
  return RULES.filter(([, rule]) => rule.test(text)).map(([name]) => name);
}

export default function Trends() {
  const q = useTrends();
  const [selected, setSelected] = useState<Category>('전체');
  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    return selected === '전체' ? all : all.filter((item) => categoriesOf(item).includes(selected));
  }, [q.data?.items, selected]);

  return (
    <Page>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>WEEKLY SIGNAL</Text>
        <Text style={styles.title}>개발 흐름을{`\n`}짧게 따라잡기.</Text>
        <Text style={styles.subtitle}>Velog 인기 글을 개발 분야별로 묶어서, 지금 읽을 가치가 있는 글부터 보여줘요.</Text>
      </View>

      <View style={styles.filters}>
        {CATEGORIES.map((category) => {
          const active = category === selected;
          return (
            <Pressable key={category} onPress={() => setSelected(category)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionEyebrow}>READ NEXT</Text>
          <Text style={ui.h2}>{selected === '전체' ? '이번 주 주목할 글' : selected}</Text>
        </View>
        {!q.isLoading ? <Text style={styles.count}>{items.length}개</Text> : null}
      </View>

      {q.isLoading && <Loading />}
      {q.error && <ErrorBox message={q.error.message} />}
      {!q.isLoading && !q.error && items.length === 0 ? (
        <Card>
          <Text style={ui.h2}>아직 새 글이 없어요</Text>
          <Text style={ui.muted}>다음 Velog 수집 때 이 분야의 글이 자동으로 들어옵니다.</Text>
        </Card>
      ) : null}

      {items.map((x, index) => {
        const categories = categoriesOf(x);
        return (
          <Card key={x.id} onPress={() => router.push(`/trend/${x.id}`)}>
            <View style={styles.rankRow}>
              <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.open}>↗</Text>
            </View>
            <Text style={styles.cardTitle}>{x.title}</Text>
            {categories.length > 0 ? <View style={ui.row}>{categories.slice(0, 3).map((c) => <Badge key={c}>{c}</Badge>)}</View> : null}
            {x.summary ? <Text numberOfLines={3} style={styles.summary}>{x.summary}</Text> : null}
            {x.whyRead ? (
              <View style={styles.whyBox}>
                <Text style={styles.whyLabel}>WHY READ</Text>
                <Text numberOfLines={2} style={styles.whyText}>{x.whyRead}</Text>
              </View>
            ) : null}
          </Card>
        );
      })}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 4, paddingBottom: 8 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 33, lineHeight: 39, fontWeight: '900', letterSpacing: -1.25 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 9, maxWidth: 330 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: '#9DA7B5', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: colors.bg },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  sectionEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 2 },
  count: { color: colors.muted, fontSize: 12, fontWeight: '800', paddingBottom: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center' },
  rank: { color: '#667184', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  open: { color: '#8EA9FF', fontSize: 17, fontWeight: '800' },
  cardTitle: { color: colors.text, fontSize: 20, lineHeight: 28, fontWeight: '900', letterSpacing: -0.45 },
  summary: { color: '#C8CED8', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  whyBox: { marginTop: 2, borderRadius: 14, backgroundColor: '#0D1219', borderWidth: 1, borderColor: '#202834', padding: 12, gap: 4 },
  whyLabel: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  whyText: { color: '#AAB4C3', fontSize: 12, lineHeight: 18, fontWeight: '650' as any },
});
