import type { DiaryInput, Farm, PublicUser } from '@agritwin/shared';

type Cached = { data: unknown; savedAt: string };
export type DiaryDraft = { farmId: string; entry: DiaryInput };
type OfflineData = { user: PublicUser; records: Record<string, Cached>; drafts: DiaryDraft[] };
let active: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
export let offlineView = false;
export let offlineWarning = '';
export const offlineEvent = () => window.dispatchEvent(new Event('agritwin:offline'));
export function markOffline(value: boolean) {
  offlineView = value;
  offlineEvent();
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('agritwin-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser cannot save offline data.'));
  });
}
async function read<T>(key: string): Promise<T | undefined> {
  const db = await database();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction('records').objectStore('records').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
async function write(key: string, value: unknown) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      if (value === undefined) tx.objectStore('records').delete(key);
      else tx.objectStore('records').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error('Offline storage is full or unavailable. Your changes were not saved.'));
      tx.onabort = () => reject(new Error('Offline save was interrupted. Please try again.'));
    });
  } finally {
    db.close();
  }
}
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(async () =>
    navigator.locks ? await navigator.locks.request('agritwin-offline-write', fn) : await fn(),
  );
  queue = next.catch(() => {});
  return next;
}
export async function restoreOfflineAccount() {
  active = (await read<string>('active').catch(() => undefined)) || null;
}
export async function setOfflineAccount(id: string | null) {
  active = id;
  // A fresh login must not leave the previous account available after an offline reload.
  await serial(async () => {
    const saved = id ? await read<OfflineData>(id) : undefined;
    await write('active', saved ? id : undefined);
  }).catch(() => {});
}
export async function offlineData() {
  return active ? read<OfflineData>(active) : undefined;
}
export async function enableOffline(user: PublicUser, farms: Farm[]) {
  await serial(async () => {
    const previous = await read<OfflineData>(user.id);
    const now = new Date().toISOString();
    const records: Record<string, Cached> = {
      '/auth/me': { data: { user }, savedAt: now },
      '/farms': { data: farms, savedAt: now },
    };
    for (const farm of farms) records[`/farms/${farm.id}`] = { data: farm, savedAt: now };
    await write(user.id, { user, records, drafts: previous?.drafts || [] });
    await write('active', user.id);
    active = user.id;
  });
  offlineWarning = '';
  offlineEvent();
}
const cacheable = (path: string) =>
  path === '/auth/me' || /^\/farms(?:\/[^/]+(?:\/predictions)?)?$/.test(path);
export async function cacheResponse(path: string, data: any) {
  const userId = active;
  if (!userId || !cacheable(path)) return;
  await serial(async () => {
    const saved = await read<OfflineData>(userId);
    if (!saved) return;
    if (path === '/auth/me' && data.user?.id !== userId) return;
    if (path === '/farms') {
      if (!Array.isArray(data) || data.some((f: Farm) => f.ownerId !== userId)) return;
      const ids = new Set(data.map((f: Farm) => f.id));
      for (const key of Object.keys(saved.records))
        if (key.startsWith('/farms/') && !ids.has(key.split('/')[2])) delete saved.records[key];
    } else if (
      path.startsWith('/farms/') &&
      !path.endsWith('/predictions') &&
      data.ownerId !== userId
    )
      return;
    saved.records[path] = { data, savedAt: new Date().toISOString() };
    await write(userId, saved);
  });
  offlineEvent();
}
export async function cachedResponse(path: string) {
  if (!cacheable(path)) return undefined;
  return (await offlineData())?.records[path];
}
export async function saveDraft(farmId: string, entry: DiaryInput) {
  const userId = active;
  await serial(async () => {
    const saved = userId ? await read<OfflineData>(userId) : undefined;
    if (!saved?.records[`/farms/${farmId}`])
      throw new Error('Save this farm for offline use before adding drafts.');
    if (saved.drafts.length >= 200) throw new Error('Sync your saved drafts before adding more.');
    if (!saved.drafts.some((d) => d.entry.id === entry.id)) saved.drafts.push({ farmId, entry });
    await write(userId!, saved);
  });
  offlineEvent();
}
export async function removeDraft(id: string) {
  const userId = active;
  await serial(async () => {
    const saved = userId ? await read<OfflineData>(userId) : undefined;
    if (saved) {
      saved.drafts = saved.drafts.filter((d) => d.entry.id !== id);
      await write(userId!, saved);
    }
  });
  offlineEvent();
}
export async function clearOffline() {
  const userId = active;
  await serial(async () => {
    if (userId) await write(userId, undefined);
    await write('active', undefined);
  });
  offlineWarning = '';
  offlineEvent();
}
export async function lockOffline() {
  active = null;
  await write('active', undefined).catch(() => {});
  markOffline(false);
}
export function warnOffline() {
  offlineWarning = 'Offline copy could not be updated. Go online and save it again.';
  offlineEvent();
}
