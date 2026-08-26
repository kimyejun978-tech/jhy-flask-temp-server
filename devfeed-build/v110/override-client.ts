import { Platform } from 'react-native';
import * as Application from 'expo-application';

const COMPILED_API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const RUNTIME_CONFIG_URL = 'https://raw.githubusercontent.com/kimyejun978-tech/jhy-flask-temp-server/devfeed-runtime/devfeed-runtime.json';
let runtimeApiUrl: string | null = null;
let lastRuntimeCheck = 0;
let cachedUserId: string | null = null;

async function resolveApiUrl(): Promise<string> {
  if (COMPILED_API_URL) return COMPILED_API_URL;
  if (runtimeApiUrl) return runtimeApiUrl;
  const now = Date.now();
  if (now - lastRuntimeCheck < 15000) throw new Error('DevFeed 서버 주소를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  lastRuntimeCheck = now;
  const response = await fetch(`${RUNTIME_CONFIG_URL}?t=${now}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('DevFeed 서버 설정을 불러오지 못했습니다.');
  const config = (await response.json()) as { apiUrl?: unknown };
  if (typeof config.apiUrl !== 'string' || !/^https:\/\//.test(config.apiUrl)) throw new Error('DevFeed 서버 설정이 올바르지 않습니다.');
  runtimeApiUrl = config.apiUrl.replace(/\/$/, '');
  return runtimeApiUrl;
}

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  if (Platform.OS === 'android') {
    const id = Application.getAndroidId();
    if (!id) throw new Error('기기 사용자 ID를 만들 수 없습니다.');
    cachedUserId = `android-${id}`;
    return cachedUserId;
  }
  if (Platform.OS === 'ios') {
    const id = await Application.getIosIdForVendorAsync();
    if (!id) throw new Error('기기 사용자 ID를 만들 수 없습니다.');
    cachedUserId = `ios-${id}`;
    return cachedUserId;
  }
  cachedUserId = `web-${Application.applicationId ?? 'devfeed'}`;
  return cachedUserId;
}

export async function getUserDisplayId(): Promise<string> {
  const id = await getUserId();
  return `••••${id.slice(-6)}`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const [apiUrl, userId] = await Promise.all([resolveApiUrl(), getUserId()]);
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}
