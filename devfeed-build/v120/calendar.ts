import * as Calendar from 'expo-calendar';
import type { EventItem } from './types';

export type DeviceCalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendarId: string;
  calendarTitle: string;
};

export async function hasCalendarPermission(requestIfNeeded = false): Promise<boolean> {
  let permission = await Calendar.getCalendarPermissionsAsync();
  if (permission.status !== 'granted' && requestIfNeeded) permission = await Calendar.requestCalendarPermissionsAsync();
  return permission.status === 'granted';
}

export async function loadDeviceCalendarEvents(start: Date, end: Date, requestIfNeeded = false): Promise<DeviceCalendarEvent[]> {
  const granted = await hasCalendarPermission(requestIfNeeded);
  if (!granted) return [];
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ids = calendars.map((calendar) => calendar.id);
  if (!ids.length) return [];
  const names = new Map(calendars.map((calendar) => [calendar.id, calendar.title ?? '캘린더']));
  const items = await Calendar.getEventsAsync(ids, start, end);
  return items.map((item) => ({
    id: item.id,
    title: item.title || '제목 없는 일정',
    startDate: String(item.startDate),
    endDate: String(item.endDate || item.startDate),
    allDay: Boolean(item.allDay),
    calendarId: item.calendarId,
    calendarTitle: names.get(item.calendarId) ?? '캘린더',
  }));
}

function rangeForEvent(event: EventItem) {
  if (!event.startDate) return null;
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start, end };
}

export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, Math.round((end - start) / 60000));
}

export function conflictsWithEvent(event: EventItem, deviceEvents: DeviceCalendarEvent[]) {
  const range = rangeForEvent(event);
  if (!range) return [];
  return deviceEvents
    .map((item) => ({ item, minutes: overlapMinutes(range.start, range.end, new Date(item.startDate), new Date(item.endDate)) }))
    .filter((x) => x.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export async function findConflictsForEvent(event: EventItem, requestIfNeeded = false) {
  const range = rangeForEvent(event);
  if (!range) return [];
  const margin = 7 * 24 * 60 * 60 * 1000;
  const device = await loadDeviceCalendarEvents(new Date(range.start.getTime() - margin), new Date(range.end.getTime() + margin), requestIfNeeded);
  return conflictsWithEvent(event, device);
}

export async function addEventWithSystemForm(event: EventItem) {
  if (!event.startDate) throw new Error('행사 날짜가 확인되지 않았습니다.');
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return Calendar.createEventInCalendarAsync({
    title: event.title,
    startDate: start,
    endDate: end,
    location: event.isOnline ? '온라인' : (event.location ?? ''),
    notes: [event.summary ?? '', '', 'DevFeed에서 추가한 일정', event.sourceUrl].filter(Boolean).join('\n'),
  });
}

export async function addDeadlineWithSystemForm(event: EventItem) {
  if (!event.deadline) throw new Error('공식 신청 마감이 확인되지 않았습니다.');
  const start = new Date(event.deadline);
  return Calendar.createEventInCalendarAsync({
    title: `[신청 마감] ${event.title}`,
    startDate: start,
    endDate: new Date(start.getTime() + 30 * 60 * 1000),
    location: event.isOnline ? '온라인' : (event.location ?? ''),
    notes: [event.summary ?? '', '', 'DevFeed에서 추가한 신청 마감', event.sourceUrl].filter(Boolean).join('\n'),
  });
}
