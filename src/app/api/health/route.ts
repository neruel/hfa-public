// src/app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  let database: 'ok' | 'unconfigured' | 'unavailable' = 'unconfigured';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await supabaseAdmin.from('documents').select('id', { head: true, count: 'exact' }).limit(1);
      database = error ? 'unavailable' : 'ok';
    } catch {
      database = 'unavailable';
    }
  }

  const checks = {
    database,
    answerGeneration: process.env.GROQ_API_KEY ? 'configured' : 'unconfigured',
    adminAuthentication: process.env.ADMIN_API_TOKEN ? 'configured' : 'unconfigured',
  } as const;
  const ready = Object.values(checks).every((status) => status === 'ok' || status === 'configured');

  return NextResponse.json(
    { status: ready ? 'ok' : 'degraded', checks, timestamp: Date.now() },
    { status: ready ? 200 : 503 },
  );
}
