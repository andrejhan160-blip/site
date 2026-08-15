import 'server-only';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'cf_session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Multipart uploads pass a FormData body straight through. */
  formData?: FormData;
  /** Defaults to no-store: case data must never be served stale. */
  cache?: RequestCache;
}

/**
 * Server-side API client. The session cookie is read from the incoming request
 * and forwarded, so the browser never talks to the API directly and the token
 * stays httpOnly on the web origin.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    cache: options.cache ?? 'no-store',
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const record = (payload ?? {}) as { message?: string; errors?: unknown };
    throw new ApiError(response.status, record.message ?? `Request failed (${response.status})`, record.errors);
  }

  return payload as T;
}

/** Unauthenticated call used by the sign-in flow. */
export async function apiPublic<T>(
  path: string,
  body: unknown,
): Promise<{ data: T; setCookie: string | null }> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const record = (payload ?? {}) as { message?: string };
    throw new ApiError(response.status, record.message ?? `Request failed (${response.status})`);
  }

  return { data: payload as T, setCookie: response.headers.get('set-cookie') };
}

/** Extracts the session token from the API's Set-Cookie header. */
export function readSessionToken(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(setCookie);
  return match ? decodeURIComponent(match[1]) : null;
}
