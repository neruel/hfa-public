import { z } from 'zod';
import { embedQuery } from '@/lib/ai/gemini';
import { generate } from '@/lib/ai/groq';
import { supabaseAdmin } from '@/lib/supabase/server';
import { classifyQuestion } from '@/lib/routing';
import { extractKeywords, filterByRelevance, scoreFaq, similarityThreshold } from '@/lib/retrieval';
import { NextResponse } from 'next/server';

const bodySchema = z.object({
  message: z.string().trim().min(2).max(2000),
  category: z.string().uuid().nullish().transform((v) => (v ? v : undefined)),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })).max(6).optional(),
});

/**
 * Keyword & text search helper for Supabase `faqs` table
 */
async function searchFaqs(query: string) {
  const keywords = extractKeywords(query);

  if (keywords.length === 0) return [];

  // Search question, answer, and keywords columns for matching tokens
  const orConditions = keywords
    .slice(0, 4)
    .flatMap((k) => [`question.ilike.%${k}%`, `answer.ilike.%${k}%`, `keywords.ilike.%${k}%`])
    .join(',');

  const { data, error } = await supabaseAdmin
    .from('faqs')
    .select('id, category, question, answer, keywords')
    .or(orConditions)
    .limit(20);

  if (error) throw new Error(`FAQ search failed: ${error.message}`);
  if (!Array.isArray(data)) throw new Error('FAQ search returned an invalid response');

  // Rank by keyword hits and drop weak matches (a single hit in the answer only)
  return data
    .map((f) => ({ f, s: scoreFaq(f, keywords) }))
    .filter(({ s }) => s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map(({ f }) => f);
}

export async function POST(request: Request) {
  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const { message, category, history } = payload;

  const route = classifyQuestion(message);
  if (route === 'UNSUPPORTED_EXTERNAL') {
    return NextResponse.json({
      answer: '현재 연결된 주택관리 문서 및 AI 지식으로는 실시간 외부 정보(날씨, 주가 등)를 확인할 수 없습니다.',
      answerMode: 'external_required',
      sources: [],
    });
  }

  // 1. General conversation / greetings check
  const isGreetingOnly = /^(안녕하세요|안녕|반가워|반갑습니다|하이|hi|hello)[.!?~]*$/i.test(message);
  if (route === 'GENERAL_ALLOWED' && isGreetingOnly) {
    return NextResponse.json({
      answer: '안녕하세요! 주택관리 전문 AI 도우미입니다. 관리비, 입주·퇴거, 시설 유지보수, 주차, 서류 신청 등 주택관리 관련 질문은 물론 일반 생활 질문도 안내해 드립니다.',
      answerMode: 'general',
      sources: [],
    });
  }

  // 2. Search document chunks and FAQ records together.
  let vectorMatches: any[];
  let faqMatches: Awaited<ReturnType<typeof searchFaqs>>;
  try {
    const [queryVec, foundFaqs] = await Promise.all([
      embedQuery(message, undefined, 5000),
      searchFaqs(message),
    ]);

    const { data, error } = await supabaseAdmin.rpc('vector_search', {
      query_vec: queryVec,
      top_k: 5,
      threshold: similarityThreshold(),
      category_id: category ?? null,
    });
    if (error) throw new Error(`Vector search failed: ${error.message}`);
    if (!Array.isArray(data)) throw new Error('Vector search returned an invalid response');
    vectorMatches = data;
    faqMatches = foundFaqs;
  } catch (e) {
    console.error('Chat retrieval unavailable:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: '문서 검색 서비스를 사용할 수 없습니다.' }, { status: 503 });
  }

  const historyText = history?.map((h) => `${h.role}: ${h.content}`).join('\n').slice(0, 500) ?? '';

  const usedVectorMatches = filterByRelevance(vectorMatches).slice(0, 3);
  const hasVectorMatches = usedVectorMatches.length > 0;
  const hasFaqMatches = faqMatches.length > 0;

  // Case A: Matching documents or FAQ database entries found (RAG Mode)
  if (hasVectorMatches || hasFaqMatches) {
    const contextParts: string[] = [];

    if (hasFaqMatches) {
      const faqContext = faqMatches
        .map((f, idx) => `[자주 묻는 질문(FAQ) ${idx + 1}: ${f.question}]\n답변: ${f.answer}`)
        .join('\n\n');
      contextParts.push(faqContext);
    }

    if (hasVectorMatches) {
      const docContext = usedVectorMatches
        .map((m: any, idx: number) => `[문서 청크 ${idx + 1}: ${m.document_name ?? '주택관리 문서'}]\n${m.parent_content ?? m.content ?? ''}`)
        .join('\n\n');
      contextParts.push(docContext);
    }

    const context = contextParts.join('\n\n---\n\n').slice(0, 1800);

    const prompt = `당신은 아파트 생활 및 주택관리 전문 AI 도우미입니다.

[참고 데이터베이스/문서]:
${context}

${historyText ? `[이전 대화]:\n${historyText}\n` : ''}[질문]: ${message}

[답변 작성 지침]:
1. **한자(漢字) 및 중국어 절대 금지**: 한자를 전혀 쓰지 말고 100% 한국어(한글)로만 답변하세요.
2. **문서/FAQ 최우선 근거**: 상기 [참고 데이터베이스/문서]의 내용을 최우선으로 반영하여 질문에 대해 명확하고 친절한 완성된 문장으로 답변하세요.
3. **추측 금지**: 관리비 금액, 특정 날짜, 전화번호 등 데이터에 없는 수치는 지어내지 마세요.
4. **문장 완결성**: 답변이 중간에 짤리지 않고 완전한 문장으로 끝나게 하세요.`;

    let answer: string;
    try {
      answer = await generate(prompt);
    } catch (e) {
      console.error('Answer generation unavailable:', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: '답변 생성 서비스를 사용할 수 없습니다.' }, { status: 502 });
    }

    const sources = [
      ...faqMatches.map((f) => ({
        documentId: `faq-${f.id}`,
        documentName: `주택관리 FAQ (${f.category ?? '일반'})`,
        chunkId: `faq-${f.id}`,
        pageNumber: null,
        sectionTitle: f.question,
        excerpt: f.answer,
      })),
      ...usedVectorMatches.map((m: any) => ({
        documentId: m.document_id,
        documentName: m.document_name,
        chunkId: m.id,
        pageNumber: m.page_number,
        sectionTitle: m.section_title ?? m.document_name,
        excerpt: m.content,
      })),
    ];

    return NextResponse.json({ answer, answerMode: 'rag', sources });
  }

  // Case B: Strict RAG Mode - No matching documents found in DB/FAQ
  return NextResponse.json({
    answer: '현재 등록된 주택관리 규약, FAQ 및 관리 문서에서 질문과 일치하는 정보를 찾지 못했습니다. 질문 키워드를 구체적으로 입력해 주시거나 관리사무소에 직접 문의해 주세요.',
    answerMode: 'rag',
    sources: [],
  });
}
