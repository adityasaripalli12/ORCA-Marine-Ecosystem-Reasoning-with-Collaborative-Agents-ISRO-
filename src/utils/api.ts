/**
 * Returns the backend API base URL.
 *
 * Local dev  : VITE_API_URL is NOT set → returns '' (empty string).
 *              Vite's dev proxy forwards /auth/* and /api/* to :8000 transparently.
 *              The browser sees same-origin requests — zero CORS issues.
 *
 * Production : VITE_API_URL is set to the full Render/backend URL
 *              (e.g. https://floatchat-api.onrender.com).
 *              All requests go directly to that URL with CORS headers.
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  // If the env var is explicitly set, use it (production / custom local override).
  // Otherwise return '' so requests are relative — Vite proxy handles routing.
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, '');
  }
  return '';
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = path.startsWith('http')
    ? path
    : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const token = localStorage.getItem('floatchat_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.debug(`[FloatChat API] ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      console.warn(`[FloatChat API] ${options.method || 'GET'} ${url} → HTTP ${response.status}`);
    }
    return response;
  } catch (err: any) {
    const isCors = err?.message?.toLowerCase().includes('cors');
    const isRefused = err?.message?.toLowerCase().includes('failed to fetch') ||
                      err?.message?.toLowerCase().includes('network');
    console.error(
      `[FloatChat API] Request failed:`,
      `\n  URL        : ${url}`,
      `\n  Error      : ${err?.message}`,
      `\n  CORS issue : ${isCors}`,
      `\n  Connection : ${isRefused ? 'refused / backend down' : 'unknown'}`,
    );
    throw err;
  }
}
