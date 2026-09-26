import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSession, adminSessionCookie } from '@/lib/server/admin-session';

const loginSchema = z.object({ token: z.string().min(1).max(512) });

// Hash both sides first so lengths always match and timingSafeEqual never throws.
function tokensMatch(received: string, expected: string): boolean {
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const { token } = loginSchema.parse(await request.json());
    const expected = process.env.ADMIN_API_TOKEN;

    if (!expected || !tokensMatch(token, expected)) {
      return NextResponse.json({ error: 'Invalid administrator credentials' }, { status: 401 });
    }

    const session = await createAdminSession(expected);
    // The session is delivered only via the HttpOnly cookie, never in the response body.
    const response = NextResponse.json({ authenticated: true }, { status: 200 });

    // Set secure session cookie
    response.cookies.set(adminSessionCookie, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
