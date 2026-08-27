import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type FreshKind = 'event' | 'trend' | 'news';

export type FreshInput = {
  id: string;
  title: string;
  route: string;
};

export type InboxRecord = {
  key: string;
  kind: FreshKind;
  itemId: string;
  title: string;
  route: string;
  detectedAt: string;
  read: boolean;
};

const INBOX_KEY = 'devfeed:fresh-inbox:v1';
const seenKey = (kind: FreshKind) => `devfeed:fresh-seen:${kind}:v1`;
const listeners = new Set<() => void>();
let writeQueue: Promise<unknown> = Promise.resolve();

function emit() {
  listeners.forEach(listener => listener());
}

function serial<T>(fn: () => Promise<T>) {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readInbox(): Promise<InboxRecord[]> {
  const raw = await AsyncStorage.getItem(INBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function unreadIds(kind: FreshKind) {
  const inbox = await readInbox();
  return new Set(inbox.filter(item => item.kind === kind && !item.read).map(item => item.itemId));
}

export async function syncFreshItems(kind: FreshKind, items: FreshInput[]) {
  return serial(async () => {
    const rawSeen = await AsyncStorage.getItem(seenKey(kind));
    const currentIds = items.map(item => String(item.id));

    // First run after installing this feature establishes a baseline.
    // Existing content should not suddenly become dozens of fake NEW alerts.
    if (rawSeen === null) {
      await AsyncStorage.setItem(seenKey(kind), JSON.stringify(currentIds.slice(0, 600)));
      return new Set<string>();
    }

    let seen: string[] = [];
    try {
      const parsed = JSON.parse(rawSeen);
      seen = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      seen = [];
    }

    const seenSet = new Set(seen);
    const newlyFound = items.filter(item => !seenSet.has(String(item.id)));
    const mergedSeen = Array.from(new Set([...currentIds, ...seen])).slice(0, 600);
    await AsyncStorage.setItem(seenKey(kind), JSON.stringify(mergedSeen));

    if (newlyFound.length > 0) {
      const inbox = await readInbox();
      const existing = new Set(inbox.map(item => item.key));
      const detectedAt = new Date().toISOString();
      const records: InboxRecord[] = newlyFound
        .map(item => ({
          key: `${kind}:${item.id}`,
          kind,
          itemId: String(item.id),
          title: item.title,
          route: item.route,
          detectedAt,
          read: false,
        }))
        .filter(item => !existing.has(item.key));

      if (records.length > 0) {
        await AsyncStorage.setItem(INBOX_KEY, JSON.stringify([...records, ...inbox].slice(0, 250)));
        emit();
      }
    }

    return unreadIds(kind);
  });
}

export async function markFreshRead(kind: FreshKind, itemId: string) {
  await serial(async () => {
    const inbox = await readInbox();
    let changed = false;
    const next = inbox.map(item => {
      if (item.kind === kind && item.itemId === String(itemId) && !item.read) {
        changed = true;
        return { ...item, read: true };
      }
      return item;
    });
    if (changed) {
      await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(next));
      emit();
    }
  });
}

export async function markAllFreshRead() {
  await serial(async () => {
    const inbox = await readInbox();
    const changed = inbox.some(item => !item.read);
    if (!changed) return;
    await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(inbox.map(item => ({ ...item, read: true }))));
    emit();
  });
}

export async function clearFreshHistory() {
  await serial(async () => {
    await AsyncStorage.setItem(INBOX_KEY, '[]');
    emit();
  });
}

export function subscribeFresh(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFreshFeed(kind: FreshKind, items: FreshInput[]) {
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const signature = items.map(item => item.id).join('|');

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const ids = await syncFreshItems(kind, items);
      if (mounted) setUnread(ids);
    };
    void refresh();
    const unsubscribe = subscribeFresh(() => {
      void unreadIds(kind).then(ids => { if (mounted) setUnread(ids); });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [kind, signature]);

  return unread;
}

export function useFreshInbox() {
  const [items, setItems] = useState<InboxRecord[]>([]);
  const refresh = async () => setItems((await readInbox()).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const next = (await readInbox()).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
      if (mounted) setItems(next);
    };
    void load();
    const unsubscribe = subscribeFresh(() => { void load(); });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    items,
    unreadCount: items.filter(item => !item.read).length,
    refresh,
  };
}

export function freshFirst<T extends { id: string }>(items: T[], unread: Set<string>) {
  return [...items].sort((a, b) => Number(unread.has(String(b.id))) - Number(unread.has(String(a.id))));
}
