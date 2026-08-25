import * as Calendar from 'expo-calendar';

export type CalendarDraft = {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes?: string;
  location?: string;
  sourceText?: string;
};

const DAY_NAMES: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatInputDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatInputTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextWeekday(base: Date, targetDay: number, nextWeek: boolean) {
  const current = base.getDay();
  let delta = (targetDay - current + 7) % 7;
  if (nextWeek) delta += delta === 0 ? 7 : 7;
  else if (delta === 0) delta = 7;
  return addDays(startOfDay(base), delta);
}

function resolveHour(rawHour: number, ampm?: string) {
  let hour = Math.max(0, Math.min(23, rawHour));
  if (ampm === '오후' && hour < 12) hour += 12;
  if (ampm === '오전' && hour === 12) hour = 0;
  return hour;
}

function extractTimes(text: string) {
  const found: Array<{ hour: number; minute: number; raw: string; index: number }> = [];
  const colon = /(오전|오후)?\s*(\d{1,2}):(\d{2})/g;
  for (const m of text.matchAll(colon)) {
    found.push({ hour: resolveHour(Number(m[2]), m[1]), minute: Number(m[3]), raw: m[0], index: m.index ?? 0 });
  }
  const korean = /(오전|오후)?\s*(\d{1,2})시(?:\s*(반|\d{1,2}분))?/g;
  for (const m of text.matchAll(korean)) {
    const minute = m[3] === '반' ? 30 : m[3] ? Number(m[3].replace('분', '')) : 0;
    found.push({ hour: resolveHour(Number(m[2]), m[1]), minute, raw: m[0], index: m.index ?? 0 });
  }
  if (text.includes('정오')) found.push({ hour: 12, minute: 0, raw: '정오', index: text.indexOf('정오') });
  if (text.includes('자정')) found.push({ hour: 0, minute: 0, raw: '자정', index: text.indexOf('자정') });
  return found.sort((a, b) => a.index - b.index);
}

function extractDate(text: string, now: Date) {
  const today = startOfDay(now);
  if (/\b오늘\b/.test(text)) return { date: today, raw: '오늘' };
  if (/\b내일\b/.test(text)) return { date: addDays(today, 1), raw: '내일' };
  if (/\b모레\b/.test(text)) return { date: addDays(today, 2), raw: '모레' };

  const full = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (full) return { date: new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3])), raw: full[0] };

  const md = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (md) {
    let year = now.getFullYear();
    let date = new Date(year, Number(md[1]) - 1, Number(md[2]));
    if (date.getTime() < today.getTime() - 86400000) date = new Date(year + 1, Number(md[1]) - 1, Number(md[2]));
    return { date, raw: md[0] };
  }

  const slash = text.match(/(?:^|\s)(\d{1,2})[./-](\d{1,2})(?:\s|$)/);
  if (slash) {
    let date = new Date(now.getFullYear(), Number(slash[1]) - 1, Number(slash[2]));
    if (date.getTime() < today.getTime() - 86400000) date = new Date(now.getFullYear() + 1, Number(slash[1]) - 1, Number(slash[2]));
    return { date, raw: slash[0].trim() };
  }

  const weekday = text.match(/(다음\s*주\s*)?([월화수목금토일])(?:요일)?/);
  if (weekday) return { date: nextWeekday(today, DAY_NAMES[weekday[2]], Boolean(weekday[1])), raw: weekday[0] };

  return { date: today, raw: '' };
}

function extractDurationMinutes(text: string) {
  const both = text.match(/(\d+)시간\s*(\d+)분/);
  if (both) return Number(both[1]) * 60 + Number(both[2]);
  const hours = text.match(/(\d+)시간/);
  if (hours) return Number(hours[1]) * 60;
  const minutes = text.match(/(\d+)분(?:\s*동안)?/);
  if (minutes) return Number(minutes[1]);
  return 60;
}

function cleanTitle(text: string, dateRaw: string, timeRaws: string[]) {
  let title = text;
  if (dateRaw) title = title.replace(dateRaw, ' ');
  for (const raw of timeRaws) title = title.replace(raw, ' ');
  title = title
    .replace(/\d+시간\s*\d*분?/g, ' ')
    .replace(/\d+분\s*동안?/g, ' ')
    .replace(/\b(부터|까지|동안|에|으로|일정|메모|추가|등록)\b/g, ' ')
    .replace(/[~→]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title || '새 일정';
}

export function parseNaturalCalendarText(input: string, now = new Date()): CalendarDraft {
  const text = input.trim();
  if (!text) throw new Error('일정을 자연어로 입력해주세요.');

  const dateInfo = extractDate(text, now);
  const times = extractTimes(text);
  const duration = extractDurationMinutes(text);
  const allDay = times.length === 0;
  const day = startOfDay(dateInfo.date);

  let startDate = day;
  let endDate = addDays(day, 1);

  if (!allDay) {
    startDate = new Date(day);
    startDate.setHours(times[0].hour, times[0].minute, 0, 0);

    if (!dateInfo.raw && startDate.getTime() < now.getTime() - 5 * 60 * 1000) {
      startDate = addDays(startDate, 1);
    }

    if (times.length >= 2) {
      endDate = new Date(startDate);
      endDate.setHours(times[1].hour, times[1].minute, 0, 0);
      if (endDate <= startDate) endDate = addDays(endDate, 1);
    } else {
      endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    }
  }

  return {
    title: cleanTitle(text, dateInfo.raw, times.map((x) => x.raw)),
    startDate,
    endDate,
    allDay,
    notes: `자연어 입력: ${text}`,
    sourceText: text,
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
  if (Number.isNaN(day.getTime()) || day.getMonth() !== Number(dm[2]) - 1) throw new Error('날짜를 확인해주세요.');

  if (args.allDay) {
    return { title, startDate: day, endDate: addDays(day, 1), allDay: true, notes: args.notes?.trim(), location: args.location?.trim() };
  }

  const parseTime = (value: string) => {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new Error('시간은 HH:mm 형식으로 입력해주세요.');
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) throw new Error('시간을 확인해주세요.');
    return { h, min };
  };

  const start = parseTime(args.startTime);
  const end = parseTime(args.endTime);
  const startDate = new Date(day); startDate.setHours(start.h, start.min, 0, 0);
  let endDate = new Date(day); endDate.setHours(end.h, end.min, 0, 0);
  if (endDate <= startDate) endDate = addDays(endDate, 1);
  return { title, startDate, endDate, allDay: false, notes: args.notes?.trim(), location: args.location?.trim() };
}

async function findWritableCalendar() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications !== false);
  if (!writable) throw new Error('일정을 추가할 수 있는 캘린더를 찾지 못했습니다.');
  return writable;
}

export async function createDeviceCalendarEvent(draft: CalendarDraft) {
  let permission = await Calendar.getCalendarPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain !== false) permission = await Calendar.requestCalendarPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('캘린더 쓰기 권한이 필요합니다.');

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
