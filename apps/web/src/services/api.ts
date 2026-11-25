import {
  cacheResponse,
  cachedResponse,
  lockOffline,
  markOffline,
  warnOffline,
  setOfflineAccount,
} from './offline';
export const API = import.meta.env.VITE_API_URL || '';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class NetworkUnavailable extends Error {
  constructor() {
    super('Internet is unavailable. Saved farms and diary drafts are available offline.');
  }
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const isRead = !options.method || options.method === 'GET';
  let res: Response;
  try {
    if (!navigator.onLine) throw new NetworkUnavailable();
    res = await fetch(`${API}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal || AbortSignal.timeout(20000),
    });
  } catch {
    markOffline(true);
    if (isRead) {
      const cached = await cachedResponse(path).catch(() => undefined);
      if (cached) return cached.data as T;
    }
    throw new NetworkUnavailable();
  }
  const data = await res.json().catch(() => {
    throw new ApiError(res.status, 'The server is temporarily unavailable. Please try again.');
  });
  if (res.status === 401 && (path === '/auth/me' || !path.startsWith('/auth/'))) {
    await lockOffline();
    window.dispatchEvent(new Event('agritwin:session-expired'));
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed');
  if (path.startsWith('/auth/') && data.user?.id) await setOfflineAccount(data.user.id);
  if (isRead) await cacheResponse(path, data).catch(warnOffline);
  if (!isRead && /^\/farms(?:\/[^/]+.*)?$/.test(path) && data.ownerId)
    await cacheResponse(`/farms/${data.id}`, data).catch(warnOffline);
  if (path === '/auth/me') markOffline(false);
  return data;
}
export const post = <T = any>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
