import { NextResponse } from 'next/server';
import { ApiError, apiPublic, readSessionToken, SESSION_COOKIE } from '@/lib/api';
import type { Profile } from '@/lib/types';

/**
 * Exchanges the emailed token for a session.
 *
 * This is a route handler rather than a page because it writes a cookie: the
 * API's session cookie is re-issued on the web origin so the token stays
 * httpOnly and same-site for the browser, and the API is never called from it.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get('token');
  const origin = new URL(request.url).origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('This sign-in link is incomplete.')}`);
  }

  try {
    const { data, setCookie } = await apiPublic<{ user: Profile; expiresAt: string }>('/auth/verify', { token });
    const sessionToken = readSessionToken(setCookie);
    if (!sessionToken) throw new Error('The API did not return a session');

    const destination = data.user.role === 'CLIENT' ? '/portal' : '/dashboard';
    const response = NextResponse.redirect(`${origin}${destination}`);

    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(data.expiresAt),
    });

    return response;
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'This sign-in link is invalid or has already been used.';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }
}
