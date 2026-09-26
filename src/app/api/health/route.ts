// src/app/api/health/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
