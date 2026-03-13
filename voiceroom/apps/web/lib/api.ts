// Base URL for API (same host in prod or env)
const getBaseUrl = () => {
  if (typeof window !== 'undefined') return process.env.NEXT_PUBLIC_API_URL || '';
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
};

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ data?: T; error?: string; code?: string }> {
  const { token, ...init } = options;
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { error: json.error || res.statusText, code: json.code };
  }
  return { data: json.data ?? json };
}
