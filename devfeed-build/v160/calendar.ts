import * as Calendar from 'expo-calendar';
import type { EventDatePrecision, EventItem } from './types';

export type DeviceCalendarEvent = {
  id: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendarId: string;
  calendarTitle: string;
  location?: string;
  notes?: string;
};
export type CalendarSnapshot = { events: DeviceCalendarEvent[]; calendarCount: number; failedCalendarCount: number };
export type EventTiming = { start: Date; end: Date; displayEnd: Date; allDayLike: boolean; multiDay: boolean; precise: boolean; durationDays: number };
export type EventConflict = { item: DeviceCalendarEvent; minutes: number; approximate: boolean };

function toIso(value: unknown): string | null { try { const d = value instanceof Date ? value : new Date(String(value)); return Number.isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; } }
function dateOnlyParts(value: string | null | undefined) { if (!value) return null; const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|\+00:00))?$/); return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null; }
export function isDateOnlyValue(value: string | null | undefined) { return Boolean(dateOnlyParts(value)); }
function parseSourceDate(value: string) { const p = dateOnlyParts(value); return p ? new Date(p.y, p.m, p.d, 0, 0, 0, 0) : new Date(value); }
function nextLocalDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0); }
function sameLocalDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatDate(d: Date) { return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }); }
function formatDateTime(d: Date) { return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
function inferredFullMonth(event: EventItem) { const s = dateOnlyParts(event.startDate), e = dateOnlyParts(event.endDate); if (!s || !e || s.y !== e.y || s.m !== e.m || s.d !== 1) return false; return e.d === new Date(s.y, s.m + 1, 0).getDate(); }

export function eventPrecision(event: EventItem): EventDatePrecision { if (event.datePrecision) return event.datePrecision; if (inferredFullMonth(event)) return 'MONTH'; return event.startDate ? 'EXACT' : 'TBD'; }
export function isExactEvent(event: EventItem) { return eventPrecision(event) === 'EXACT' && Boolean(event.startDate); }
export function getEventTiming(event: EventItem): EventTiming | null {
  if (!isExactEvent(event) || !event.startDate) return null;
  const start = parseSourceDate(event.startDate); if (Number.isNaN(start.getTime())) return null;
  const startAllDay = isDateOnlyValue(event.startDate); const endAllDay = event.endDate ? isDateOnlyValue(event.endDate) : startAllDay;
  if (startAllDay) {
    let displayEnd = event.endDate ? parseSourceDate(event.endDate) : start;
    if (Number.isNaN(displayEnd.getTime()) || displayEnd < start) displayEnd = start;
    const end = nextLocalDay(displayEnd);
    const durationDays = Math.max(1, Math.round((new Date(displayEnd.getFullYear(), displayEnd.getMonth(), displayEnd.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000) + 1);
    return { start, end, displayEnd, allDayLike: true, multiDay: durationDays > 1, precise: false, durationDays };
  }
  let end = event.endDate ? parseSourceDate(event.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (Number.isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const durationMs = end.getTime() - start.getTime();
  return { start, end, displayEnd: end, allDayLike: false, multiDay: !sameLocalDay(start, end) || durationMs > 86400000, precise: !endAllDay && durationMs <= 86400000, durationDays: Math.max(1, Math.ceil(durationMs / 86400000)) };
}
export function eventDateLabel(event: EventItem) {
  const precision = eventPrecision(event);
  if (precision !== 'EXACT') { if (event.dateText) return event.dateText; const p = dateOnlyParts(event.startDate); if (precision === 'MONTH' && p) return `${p.y}년 ${p.m + 1}월 중`; return '정확한 일정 추후 발표'; }
  const timing = getEventTiming(event); if (!timing) return '일정 확인 필요';
  if (timing.allDayLike) return timing.multiDay ? `${formatDate(timing.start)} ~ ${formatDate(timing.displayEnd)}` : `${formatDate(timing.start)} · 하루 종일`;
  if (timing.precise) return `${formatDateTime(timing.start)} ~ ${timing.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  return `${formatDateTime(timing.start)} ~ ${formatDateTime(timing.end)}`;
}
export function approximateMatchesMonth(event: EventItem, month: Date) { if (eventPrecision(event) === 'EXACT') return false; const text = event.dateText ?? eventDateLabel(event); const m = text.match(/(\d{4})년\s*(\d{1,2})월/); return m ? Number(m[1]) === month.getFullYear() && Number(m[2]) === month.getMonth() + 1 : false; }
export function describeEventTiming(event: EventItem) { return eventPrecision(event) === 'EXACT' ? eventDateLabel(event) : `${eventDateLabel(event)} · 정확한 날짜 미정`; }
function normalizeTitle(value: string) { return value.toLowerCase().replace(/[^0-9a-z가-힣]+/gi, ''); }
export function isLikelySameEvent(event: EventItem, item: DeviceCalendarEvent) {
  const a = normalizeTitle(event.title || ''), b = normalizeTitle(item.title || ''); if (!a || a !== b) return false;
  const deviceStart = new Date(item.startDate); if (Number.isNaN(deviceStart.getTime())) return false;
  if (eventPrecision(event) !== 'EXACT') { const p = dateOnlyParts(event.startDate); return p ? deviceStart.getFullYear() === p.y && deviceStart.getMonth() === p.m : true; }
  const timing = getEventTiming(event); if (!timing) return false; if (timing.allDayLike) return sameLocalDay(timing.start, deviceStart); return Math.abs(timing.start.getTime() - deviceStart.getTime()) <= 6 * 60 * 60 * 1000;
}

export async function hasCalendarPermission(requestIfNeeded = false) { let permission = await Calendar.getCalendarPermissionsAsync(); if (permission.status !== 'granted' && requestIfNeeded && permission.canAskAgain !== false) permission = await Calendar.requestCalendarPermissionsAsync(); return permission.status === 'granted'; }
export async function loadDeviceCalendarSnapshot(start: Date, end: Date, requestIfNeeded = false): Promise<CalendarSnapshot> {
  const granted = await hasCalendarPermission(requestIfNeeded); if (!granted) return { events: [], calendarCount: 0, failedCalendarCount: 0 };
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT); const usable = calendars.filter(c => Boolean(c.id)); if (!usable.length) return { events: [], calendarCount: 0, failedCalendarCount: 0 };
  const settled = await Promise.allSettled(usable.map(async cal => (await Calendar.getEventsAsync([cal.id], start, end)).map(item => ({ item, cal }))));
  const out: DeviceCalendarEvent[] = []; let failed = 0;
  for (const result of settled) {
    if (result.status === 'rejected') { failed += 1; continue; }
    for (const { item, cal } of result.value) {
      const startDate = toIso(item.startDate), endDate = toIso(item.endDate ?? item.startDate); if (!startDate || !endDate) continue;
      out.push({ id: `${cal.id}:${item.id}:${startDate}`, eventId: String(item.id), title: item.title || '제목 없는 일정', startDate, endDate, allDay: Boolean(item.allDay), calendarId: cal.id, calendarTitle: cal.title || '캘린더', location: item.location || undefined, notes: item.notes || undefined });
    }
  }
  const dedup = new Map<string, DeviceCalendarEvent>(); for (const item of out) dedup.set(item.id, item);
  return { events: [...dedup.values()].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()), calendarCount: usable.length, failedCalendarCount: failed };
}
export async function loadDeviceCalendarEvents(start: Date, end: Date, requestIfNeeded = false) { return (await loadDeviceCalendarSnapshot(start, end, requestIfNeeded)).events; }
export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) { const start = Math.max(aStart.getTime(), bStart.getTime()), end = Math.min(aEnd.getTime(), bEnd.getTime()); return Math.max(0, Math.round((end - start) / 60000)); }
export function conflictsWithEvent(event: EventItem, deviceEvents: DeviceCalendarEvent[]): EventConflict[] {
  const timing = getEventTiming(event); if (!timing) return []; const result: EventConflict[] = [];
  for (const item of deviceEvents) { if (isLikelySameEvent(event, item)) continue; const bStart = new Date(item.startDate), bEnd = new Date(item.endDate); if (Number.isNaN(bStart.getTime()) || Number.isNaN(bEnd.getTime())) continue; const overlap = overlapMinutes(timing.start, timing.end, bStart, bEnd); if (overlap <= 0) continue; result.push(timing.precise ? { item, minutes: overlap, approximate: false } : { item, minutes: 0, approximate: true }); }
  return result.sort((a, b) => Number(a.approximate) - Number(b.approximate) || b.minutes - a.minutes);
}
export async function findConflictsForEvent(event: EventItem, requestIfNeeded = false) { const timing = getEventTiming(event); if (!timing) return []; const margin = 86400000; return conflictsWithEvent(event, await loadDeviceCalendarEvents(new Date(timing.start.getTime() - margin), new Date(timing.end.getTime() + margin), requestIfNeeded)); }
export async function addEventWithSystemForm(event: EventItem) { const timing = getEventTiming(event); if (!timing) throw new Error('정확한 행사 날짜가 공개된 뒤 캘린더에 추가할 수 있습니다.'); return Calendar.createEventInCalendarAsync({ title: event.title, startDate: timing.start, endDate: timing.end, allDay: timing.allDayLike, location: event.isOnline ? '온라인' : (event.location ?? ''), notes: [event.summary ?? '', '', 'DevFeed에서 추가한 일정', event.sourceUrl].filter(Boolean).join('\n') }); }
export async function addDeadlineWithSystemForm(event: EventItem) { if (!event.deadline) throw new Error('공식 신청 마감이 확인되지 않았습니다.'); const allDay = isDateOnlyValue(event.deadline); const start = parseSourceDate(event.deadline); if (Number.isNaN(start.getTime())) throw new Error('신청 마감 날짜 형식을 확인하지 못했습니다.'); return Calendar.createEventInCalendarAsync({ title: `[신청 마감] ${event.title}`, startDate: start, endDate: allDay ? nextLocalDay(start) : new Date(start.getTime() + 30 * 60 * 1000), allDay, location: event.isOnline ? '온라인' : (event.location ?? ''), notes: [event.summary ?? '', '', 'DevFeed에서 추가한 신청 마감', event.sourceUrl].filter(Boolean).join('\n') }); }
