const COOKIE_NAME = 'hfa_admin_session';

function encode(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value: string): string {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return encode(String.fromCharCode(...new Uint8Array(bytes)));
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function createAdminSession(secret: string): Promise<string> {
  const payload = `${Date.now()}:${crypto.randomUUID()}`;
  return `${encode(payload)}.${await signature(payload, secret)}`;
}

export async function verifyAdminSession(value: string, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const [encodedPayload, received] = value.split('.');
  if (!encodedPayload || !received) return false;
  try {
    const payload = decode(encodedPayload);
    const timestamp = Number(payload.split(':')[0]);
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
    return constantTimeEqual(received, await signature(payload, secret));
  } catch {
    return false;
  }
}

export async function isAdminSession(request: Request, secret: string | undefined): Promise<boolean> {
  const cookie = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return false;
  return verifyAdminSession(cookie.slice(COOKIE_NAME.length + 1), secret);
}

export const adminSessionCookie = COOKIE_NAME;
