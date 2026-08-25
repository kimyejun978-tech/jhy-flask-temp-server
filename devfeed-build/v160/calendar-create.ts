import * as Calendar from 'expo-calendar';
import { api } from '@/api/client';

export type CalendarDraft = {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes?: string;
  location?: string;
  sourceText?: string;
};

export type AiCalendarParseResult = {
  draft: CalendarDraft;
  interpretation: string;
  confidence: number;
  needsConfirmation: boolean;
  source: 'ai';
};

type AiCalendarResponse = {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
  interpretation?: string;
  confidence?: number;
  needsConfirmation?: boolean;
  source?: 'ai';
};

function pad(n: number) { return String(n).padStart(2, '0'); }
export function formatInputDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function formatInputTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }

async function ensureCalendarPermission() {
  let permission = await Calendar.getCalendarPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain !== false) permission = await Calendar.requestCalendarPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('캘린더 권한이 필요합니다.');
}

async function findWritableCalendar() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications !== false);
  if (!writable) throw new Error('일정을 저장할 수 있는 캘린더를 찾지 못했습니다.');
  return writable;
}

export async function parseNaturalCalendarTextWithAI(input: string): Promise<AiCalendarParseResult> {
  const text = input.trim();
  if (!text) throw new Error('일정을 자연어로 입력해주세요.');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  const result = await api<AiCalendarResponse>('/v1/calendar/parse', {
    method: 'POST',
    body: JSON.stringify({ text, now: new Date().toISOString(), timezone, locale: 'ko-KR' }),
  });
  const startDate = new Date(result.startDate);
  const endDate = new Date(result.endDate);
  if (!result.title?.trim() || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error('AI가 일정 날짜를 올바르게 해석하지 못했습니다. 다시 적어주세요.');
  }
  return {
    draft: {
      title: result.title.trim(),
      startDate,
      endDate,
      allDay: Boolean(result.allDay),
      location: result.location?.trim() || undefined,
      notes: result.notes?.trim() || `AI 자연어 입력: ${text}`,
      sourceText: text,
    },
    interpretation: result.interpretation?.trim() || `${result.title.trim()} 일정`,
    confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0.8,
    needsConfirmation: Boolean(result.needsConfirmation),
    source: 'ai',
  };
}

export function buildManualDraft(args: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  notes?: string;
  location?: string;
}): CalendarDraft {
  const title = args.title.trim();
  if (!title) throw new Error('일정 제목을 입력해주세요.');
  const dm = args.date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) throw new Error('날짜는 YYYY-MM-DD 형식으로 입력해주세요.');
  const day = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), 0, 0, 0, 0);
  if (Number.isNaN(day.getTime()) || day.getMonth() !== Number(dm[2]) - 1 || day.getDate() !== Number(dm[3])) throw new Error('날짜를 확인해주세요.');
  if (args.allDay) return { title, startDate: day, endDate: addDays(day, 1), allDay: true, notes: args.notes?.trim(), location: args.location?.trim() };

  const parseTime = (value: string) => {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new Error('시간은 HH:mm 형식으로 입력해주세요.');
    const h = Number(m[1]), min = Number(m[2]);
    if (h > 23 || min > 59) throw new Error('시간을 확인해주세요.');
    return { h, min };
  };
  const start = parseTime(args.startTime), end = parseTime(args.endTime);
  const startDate = new Date(day); startDate.setHours(start.h, start.min, 0, 0);
  let endDate = new Date(day); endDate.setHours(end.h, end.min, 0, 0);
  if (endDate <= startDate) endDate = addDays(endDate, 1);
  return { title, startDate, endDate, allDay: false, notes: args.notes?.trim(), location: args.location?.trim() };
}

export async function createDeviceCalendarEvent(draft: CalendarDraft) {
  await ensureCalendarPermission();
  const calendar = await findWritableCalendar();
  const id = await Calendar.createEventAsync(calendar.id, {
    title: draft.title,
    startDate: draft.startDate,
    endDate: draft.endDate,
    allDay: draft.allDay,
    notes: draft.notes ?? '',
    location: draft.location ?? '',
  });
  return { id, calendarTitle: calendar.title || '캘린더' };
}

export async function getDeviceCalendarEventDraft(eventId: string) {
  await ensureCalendarPermission();
  const event = await Calendar.getEventAsync(eventId);
  if (!event) throw new Error('일정을 찾지 못했습니다.');
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate ?? event.startDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) throw new Error('일정 시간을 읽지 못했습니다.');
  return {
    draft: {
      title: event.title || '제목 없는 일정',
      startDate,
      endDate: endDate > startDate ? endDate : new Date(startDate.getTime() + 60 * 60 * 1000),
      allDay: Boolean(event.allDay),
      notes: event.notes || undefined,
      location: event.location || undefined,
    } satisfies CalendarDraft,
    calendarId: String(event.calendarId || ''),
  };
}

export async function updateDeviceCalendarEvent(eventId: string, draft: CalendarDraft) {
  await ensureCalendarPermission();
  await Calendar.updateEventAsync(eventId, {
    title: draft.title,
    startDate: draft.startDate,
    endDate: draft.endDate,
    allDay: draft.allDay,
    notes: draft.notes ?? '',
    location: draft.location ?? '',
  });
}

export async function deleteDeviceCalendarEvent(eventId: string) {
  await ensureCalendarPermission();
  await Calendar.deleteEventAsync(eventId);
}
