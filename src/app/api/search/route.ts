import { z } from 'zod';
import { embedQuery } from '@/lib/ai/gemini';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { filterByRelevance, similarityThreshold } from '@/lib/retrieval';

const querySchema = z.object({ q: z.string().min(2).max(2000) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: '검색어는 2자 이상 2000자 이하여야 합니다.' }, { status: 400 });
  }

  try {
    const queryVec = await embedQuery(parsed.data.q);

    const { data: matches, error } = await supabaseAdmin.rpc('vector_search', {
      query_vec: queryVec,
      top_k: 20,
      threshold: similarityThreshold(),
      category_id: null,
    });

    if (error) {
      console.error('Vector search unavailable:', error.message);
      return NextResponse.json({ error: '검색 서비스를 사용할 수 없습니다.' }, { status: 503 });
    }

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
    console.error('Search request failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: '검색 서비스를 사용할 수 없습니다.' }, { status: 503 });
  }
}
