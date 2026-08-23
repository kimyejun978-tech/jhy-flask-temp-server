import type { EventItem, NewsItem, TrendItem } from '../types';

const COMPILED_API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const RUNTIME_CONFIG_URL = 'https://raw.githubusercontent.com/kimyejun978-tech/jhy-flask-temp-server/devfeed-runtime/devfeed-runtime.json';
let runtimeApiUrl: string | null = null;
let lastRuntimeCheck = 0;

async function resolveApiUrl(): Promise<string | null> {
  if (COMPILED_API_URL) return COMPILED_API_URL;
  if (runtimeApiUrl) return runtimeApiUrl;
  const now = Date.now();
  if (now - lastRuntimeCheck < 15000) return null;
  lastRuntimeCheck = now;
  try {
    const response = await fetch(`${RUNTIME_CONFIG_URL}?t=${now}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const config = (await response.json()) as { apiUrl?: unknown };
    if (typeof config.apiUrl !== 'string' || !/^https:\/\//.test(config.apiUrl)) return null;
    runtimeApiUrl = config.apiUrl.replace(/\/$/, '');
    return runtimeApiUrl;
  } catch {
    return null;
  }
}

export const USER_ID = 'local-default';

const events: EventItem[] = [
  {
    id: 'demo-ai-hackathon',
    title: 'AI Game Builders Seoul',
    categories: ['AI', 'Hackathon'],
    startDate: '2026-08-31T10:00:00+09:00',
    endDate: '2026-08-31T18:00:00+09:00',
    deadline: '2026-08-26T23:59:59+09:00',
    location: '서울',
    isOnline: false,
    fee: 0,
    highSchoolAllowed: true,
    importance: 'HIGH',
    summary: 'AI 도구를 활용해 짧은 시간 안에 실제 결과물을 만드는 개발 행사입니다.',
    sourceUrl: 'https://example.com',
    userStatus: 'NONE',
  },
  {
    id: 'demo-embedded',
    title: 'Embedded & Robotics Tech Day',
    categories: ['Embedded', 'Robotics'],
    startDate: '2026-09-12T10:00:00+09:00',
    endDate: '2026-09-12T17:00:00+09:00',
    deadline: '2026-09-08T23:59:59+09:00',
    location: '대전',
    isOnline: false,
    fee: 0,
    highSchoolAllowed: null,
    importance: 'MEDIUM',
    summary: '임베디드와 로봇 분야의 프로젝트 및 기술 세션을 한 번에 살펴보는 행사입니다.',
    sourceUrl: 'https://example.com',
    userStatus: 'INTERESTED',
  },
];

const trends: TrendItem[] = [
  {
    id: 'demo-mcp',
    title: 'MCP 서버를 직접 만들어보며 이해하기',
    author: 'DevFeed Demo',
    url: 'https://velog.io',
    tags: ['AI', 'Backend', 'MCP'],
    summary: 'MCP의 Tool과 Resource 구조를 실제 구현 흐름 중심으로 정리한 글입니다.',
    whyRead: 'AI Agent 생태계에서 MCP를 연결하는 방식이 빠르게 표준화되고 있기 때문입니다.',
    tryNext: '간단한 weather MCP 서버를 직접 만들어보기',
    importance: 'HIGH',
    publishedAt: '2026-08-23T14:00:00+09:00',
  },
  {
    id: 'demo-edge',
    title: 'Edge 환경에서 API를 설계할 때 생각할 것들',
    author: 'DevFeed Demo',
    url: 'https://velog.io',
    tags: ['Cloudflare', 'Backend'],
    summary: '짧은 실행 시간과 분산 환경을 고려한 API 설계 포인트를 설명합니다.',
    whyRead: 'Workers 같은 Edge 런타임을 사용할 때 전통적인 서버 설계와 다른 점을 잡기 좋습니다.',
    tryNext: '작은 CRUD API를 Edge 런타임에 배포해보기',
    importance: 'MEDIUM',
    publishedAt: '2026-08-23T10:00:00+09:00',
  },
];

const news: NewsItem[] = [
  {
    id: 'demo-news',
    title: '이번 주 AI 업계에 무슨 일이?',
    url: 'https://www.youtube.com/@jocoding',
    channel: '조코딩',
    summary: 'OpenAI, Claude, Gemini와 개발 도구 쪽의 주요 변화를 개발자 관점에서 약 3분 분량으로 정리한 데모 요약입니다.',
    highlights: [
      'AI 코딩 도구는 단순 자동완성을 넘어 작업 단위 실행으로 이동하고 있습니다.',
      '모델 성능뿐 아니라 도구 연결과 컨텍스트 관리가 실제 생산성을 크게 좌우합니다.',
      '학생 개발자라면 작은 프로젝트에 새 기능을 직접 붙여보는 방식이 가장 빠른 학습법입니다.',
    ],
    publishedAt: '2026-08-23T09:00:00+09:00',
  },
];

let preferences = {
  eventsEnabled: true,
  trendsEnabled: true,
  newsEnabled: true,
  freePriority: true,
  highSchoolOnly: false,
  deadline3Enabled: true,
  deadline1Enabled: true,
  eventDayBeforeEnabled: true,
  interests: ['AI', 'Embedded', 'Robotics', 'IoT'],
};

async function mockApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (path === '/v1/events') return { items: events } as T;
  if (path === '/v1/schedule') return { items: events.filter((e) => e.userStatus === 'PLANNING' || e.userStatus === 'APPLIED') } as T;
  if (path === '/v1/preferences' && method === 'GET') return preferences as T;
  if (path === '/v1/preferences' && method === 'PUT') {
    preferences = { ...preferences, ...(JSON.parse(String(init?.body ?? '{}')) as typeof preferences) };
    return preferences as T;
  }
  if (path === '/v1/trends') return { items: trends } as T;
  if (path === '/v1/ai-news') return { items: news } as T;

  const eventMatch = path.match(/^\/v1\/events\/([^/]+)$/);
  if (eventMatch) {
    const item = events.find((e) => e.id === eventMatch[1]);
    if (!item) throw new Error('행사를 찾을 수 없습니다.');
    return item as T;
  }
  const statusMatch = path.match(/^\/v1\/events\/([^/]+)\/status$/);
  if (statusMatch && method === 'PUT') {
    const item = events.find((e) => e.id === statusMatch[1]);
    if (!item) throw new Error('행사를 찾을 수 없습니다.');
    const body = JSON.parse(String(init?.body ?? '{}')) as { status?: EventItem['userStatus'] };
    if (body.status) item.userStatus = body.status;
    return { ok: true } as T;
  }
  const trendMatch = path.match(/^\/v1\/trends\/([^/]+)$/);
  if (trendMatch) {
    const item = trends.find((e) => e.id === trendMatch[1]);
    if (!item) throw new Error('트렌드를 찾을 수 없습니다.');
    return item as T;
  }
  const newsMatch = path.match(/^\/v1\/ai-news\/([^/]+)$/);
  if (newsMatch) {
    const item = news.find((e) => e.id === newsMatch[1]);
    if (!item) throw new Error('뉴스를 찾을 수 없습니다.');
    return item as T;
  }
  throw new Error(`지원되지 않는 데모 API 경로: ${path}`);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const apiUrl = await resolveApiUrl();
  if (!apiUrl) return mockApi<T>(path, init);
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}
