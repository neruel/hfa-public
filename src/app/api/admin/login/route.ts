import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSession, adminSessionCookie } from '@/lib/server/admin-session';

const loginSchema = z.object({ token: z.string().min(1).max(512) });

export async function POST(request: Request) {
  try {
    const { token } = loginSchema.parse(await request.json());
    const expected = process.env.ADMIN_API_TOKEN;

    if (!expected || token !== expected) {
      return NextResponse.json({ error: 'Invalid administrator credentials' }, { status: 401 });
    }

    const session = await createAdminSession(expected);
    const response = NextResponse.json({ authenticated: true, session }, { status: 200 });

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
