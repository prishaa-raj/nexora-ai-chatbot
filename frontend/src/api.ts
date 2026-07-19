/**
 * Central API client.
 * - Automatically attaches the JWT Bearer token from localStorage.
 * - Resolves against VITE_API_BASE_URL when set (e.g. Docker, where the
 *   frontend and backend run on different origins); otherwise uses a
 *   relative path, which the Vite dev server proxies to the backend.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/**
 * Turns whatever shape a backend error comes in as into one readable
 * sentence. FastAPI sends `detail` as a plain string for most errors
 * (e.g. "Invalid credentials"), but for request-validation failures
 * (e.g. a password that's too short) it sends a LIST of error objects
 * instead. Passing that list straight into `new Error(...)` is what
 * produced the "[object Object]" message -- this function is the fix.
 */
function extractErrorMessage(data: any, status: number): string {
  const detail = data?.detail ?? data?.error;

  if (!detail) return `Something went wrong (error ${status}). Please try again.`;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
        const msg = item?.msg || 'is invalid';
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (messages.length) return messages.join('. ');
  }

  return `Something went wrong (error ${status}). Please try again.`;
}

export async function apiJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res.status));
  }
  return data as T;
}
