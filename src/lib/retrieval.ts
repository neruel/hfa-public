/**
 * Retrieval helpers shared by the chat and search routes.
 */

// Question words and verb endings that appear in almost every FAQ and carry no topic
const STOPWORDS = new Set([
  '어떻게', '어떤', '무엇', '뭐', '언제', '어디', '어디서', '누구', '왜', '얼마', '몇',
  '하나요', '해야', '해야하나요', '되나요', '있나요', '없나요', '인가요', '알려', '알려줘', '알려주세요',
  '주세요', '싶어요', '방법', '가능', '가능한가요', '문의', '궁금합니다', '궁금해요',
]);

// Common particles attached to Korean nouns (longest first)
const PARTICLES = ['에서는', '에서', '에게', '으로', '까지', '부터', '은', '는', '이', '가', '을', '를', '의', '에', '도', '로', '와', '과'];

function stripParticle(word: string) {
  for (const p of PARTICLES) {
    if (word.endsWith(p) && word.length - p.length >= 2) return word.slice(0, -p.length);
  }
  return word;
}

/** Extract topic keywords from a Korean question for FAQ keyword matching. */
export function extractKeywords(query: string): string[] {
  const words = query
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stripParticle)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

/** Score an FAQ by keyword hits; question hits weigh double. */
export function scoreFaq(faq: { question?: string | null; answer?: string | null; keywords?: string | null }, keywords: string[]) {
  return keywords.reduce((sum, k) => {
    const q = faq.question?.includes(k) ? 2 : 0;
    const rest = `${faq.answer ?? ''} ${faq.keywords ?? ''}`.includes(k) ? 1 : 0;
    return sum + q + rest;
  }, 0);
}

/**
 * Embedding models like multilingual-e5 score even unrelated passages around 0.75–0.8,
 * so keep only matches close to the best one instead of relying on an absolute threshold.
 */
export function filterByRelevance<T extends { score?: number | null }>(matches: T[], margin = 0.03): T[] {
  const top = matches.reduce((max, m) => Math.max(max, m.score ?? 0), 0);
  if (top === 0) return matches;
  return matches.filter((m) => (m.score ?? 0) >= top - margin);
}

/**
 * Absolute similarity floor for vector search. multilingual-e5 places unrelated passages
 * just below ~0.80, so that is the default; override with RAG_SIMILARITY_THRESHOLD.
 */
export function similarityThreshold(): number {
  const raw = Number(process.env.RAG_SIMILARITY_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : 0.8;
}
