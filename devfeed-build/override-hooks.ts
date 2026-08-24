import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { EventItem, EventStatus, NewsItem, TrendItem } from '../types';

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => api<{items: EventItem[]}>('/v1/events') });
}
export function useEvent(id: string) {
  return useQuery({ queryKey: ['event', id], queryFn: () => api<EventItem>(`/v1/events/${id}`), enabled: !!id });
}
export function useSetEventStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: EventStatus) => api(`/v1/events/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onMutate: async (status) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ['events'] }),
        qc.cancelQueries({ queryKey: ['event', id] }),
        qc.cancelQueries({ queryKey: ['schedule'] }),
      ]);
      const prevEvent = qc.getQueryData<EventItem>(['event', id]);
      const prevEvents = qc.getQueryData<{items: EventItem[]}>(['events']);
      const prevSchedule = qc.getQueryData<{items: EventItem[]}>(['schedule']);
      const apply = (item: EventItem) => item.id === id ? { ...item, userStatus: status } : item;
      if (prevEvent) qc.setQueryData<EventItem>(['event', id], { ...prevEvent, userStatus: status });
      if (prevEvents) qc.setQueryData(['events'], { items: prevEvents.items.map(apply) });
      if (prevSchedule) {
        const source = (prevEvents?.items ?? prevSchedule.items).map(apply);
        qc.setQueryData(['schedule'], { items: source.filter(x => x.userStatus === 'PLANNING' || x.userStatus === 'APPLIED') });
      }
      return { prevEvent, prevEvents, prevSchedule };
    },
    onError: (_error, _status, ctx) => {
      if (!ctx) return;
      if (ctx.prevEvent) qc.setQueryData(['event', id], ctx.prevEvent);
      if (ctx.prevEvents) qc.setQueryData(['events'], ctx.prevEvents);
      if (ctx.prevSchedule) qc.setQueryData(['schedule'], ctx.prevSchedule);
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({queryKey:['events']}),
        qc.invalidateQueries({queryKey:['event', id]}),
        qc.invalidateQueries({queryKey:['schedule']}),
      ]);
    },
  });
}
export function useSchedule() { return useQuery({ queryKey:['schedule'], queryFn: () => api<{items: EventItem[]}>('/v1/schedule') }); }

export type Preferences = {
  eventsEnabled:boolean; trendsEnabled:boolean; newsEnabled:boolean; freePriority:boolean; highSchoolOnly:boolean; deadline3Enabled:boolean; deadline1Enabled:boolean; eventDayBeforeEnabled:boolean; interests:string[];
};
export function usePreferences(){ return useQuery({queryKey:['preferences'],queryFn:()=>api<Preferences>('/v1/preferences')}); }
export function useSavePreferences(){ const qc=useQueryClient(); return useMutation({mutationFn:(prefs:Preferences)=>api('/v1/preferences',{method:'PUT',body:JSON.stringify(prefs)}),onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:['preferences']}),qc.invalidateQueries({queryKey:['events']})])}}); }

export function useTrends() { return useQuery({ queryKey: ['trends'], queryFn: () => api<{items: TrendItem[]}>('/v1/trends') }); }
export function useTrend(id: string) { return useQuery({ queryKey:['trend', id], queryFn: () => api<TrendItem>(`/v1/trends/${id}`), enabled: !!id }); }
export function useNews() {
  return useQuery({
    queryKey:['news'],
    queryFn: () => api<{items: NewsItem[]}>('/v1/ai-news'),
    refetchInterval: (query) => query.state.data?.items.some((item) => !item.summary) ? 30000 : false,
  });
}
export function useNewsItem(id: string) {
  return useQuery({
    queryKey:['news', id],
    queryFn: () => api<NewsItem>(`/v1/ai-news/${id}`),
    enabled: !!id,
    refetchInterval: (query) => query.state.data?.summary ? false : 10000,
  });
}
