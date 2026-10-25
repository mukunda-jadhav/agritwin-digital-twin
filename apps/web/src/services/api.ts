export const API = import.meta.env.VITE_API_URL || '';
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res
    .json()
    .catch(() => ({ error: 'The server is temporarily unavailable. Please try again.' }));
  if (res.status === 401 && !path.startsWith('/auth/'))
    window.dispatchEvent(new Event('agritwin:session-expired'));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const post = <T = any>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
