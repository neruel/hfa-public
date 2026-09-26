import { z } from 'zod';
import { embedQuery } from '@/lib/ai/gemini';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { filterByRelevance, similarityThreshold } from '@/lib/retrieval';

const querySchema = z.object({ q: z.string().min(2).max(2000) });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = querySchema.parse({ q: url.searchParams.get('q') ?? '' });
    const queryVec = await embedQuery(payload.q);

    const { data: matches, error } = await supabaseAdmin.rpc('vector_search', {
      query_vec: queryVec,
      top_k: 20,
      threshold: similarityThreshold(),
      category_id: null,
    });

    if (error) throw new Error(`검색 중 오류가 발생했습니다: ${error.message}`);

    const results = filterByRelevance<any>(matches ?? []).map((m: any) => ({
      id: m.id,
      documentId: m.document_id,
      documentName: m.document_name,
      chunkId: m.id,
      pageNumber: m.page_number,
      sectionTitle: m.section_title ?? m.document_name,
      excerpt: m.content,
      score: m.score ?? null,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
