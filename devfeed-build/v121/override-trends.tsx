import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, ErrorBox, Header, Loading, Page, ui } from '@/components/Ui';
import { useTrends } from '@/api/hooks';
import type { TrendItem } from '@/types';

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

  return <Page>
    <Header title="개발 트렌드"/>
    <Text style={ui.muted}>Velog 주간 인기 글을 개발 분야별로 분류해 보여줘요.</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {CATEGORIES.map((category) => {
        const active = category === selected;
        return <Pressable key={category} onPress={() => setSelected(category)} style={{paddingHorizontal:12,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:active?'#ffffff':'#3a3a3a',backgroundColor:active?'#ffffff':'#191919'}}>
          <Text style={{fontSize:13,fontWeight:'800',color:active?'#111111':'#e9e9e9'}}>{category}</Text>
        </Pressable>;
      })}
    </View>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
      <Text style={ui.h2}>{selected === '전체' ? '🔥 주목할 글' : `# ${selected}`}</Text>
      {!q.isLoading && <Text style={ui.muted}>{items.length}개</Text>}
    </View>
    {q.isLoading && <Loading/>}
    {q.error && <ErrorBox message={q.error.message}/>} 
    {!q.isLoading && !q.error && items.length === 0 && <Card><Text style={ui.body}>이 카테고리에 잡힌 새 글이 아직 없어요.</Text><Text style={ui.muted}>다음 Velog 수집 때 자동으로 갱신됩니다.</Text></Card>}
    {items.map((x) => {
      const categories = categoriesOf(x);
      return <Card key={x.id} onPress={() => router.push(`/trend/${x.id}`)}>
        <Text style={ui.h2}>{x.title}</Text>
        <View style={ui.row}>{categories.slice(0,3).map((c) => <Badge key={c}>{c}</Badge>)}</View>
        {x.summary && <Text style={ui.body}>{x.summary}</Text>}
        {x.whyRead && <Text style={ui.muted}>왜 읽을 만한가 → {x.whyRead}</Text>}
      </Card>;
    })}
  </Page>;
}
