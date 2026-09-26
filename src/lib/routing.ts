export type AnswerMode = 'rag' | 'general' | 'external_required';
export type QuestionRoute = 'RAG_REQUIRED' | 'GENERAL_ALLOWED' | 'UNSUPPORTED_EXTERNAL';

const HOUSING_TERMS =
  /관리비|임대료|임대차|입주|퇴거|주차|하자|누수|수리|보수|시설|전기|수도|가스|소방|안전|관리규약|규정|법령|조례|신청|자격|서류|공지|안내|주택관리공단|관리사무소|담당부서|연락처|전화번호|주소|보일러|난방|온수|승강기|엘리베이터|소음|층간소음|결로|곰팡이|환기|에어컨|실외기|놀이터|재활용|분리수거|소독|방역|CCTV|동대표|원상복구|이사|수선|배관|옥상|방수|도배|장판|베란다|발코니|경비|경비실|택배|우편|공용|전용|세대|아파트|공동주택|입주민|관리인|계약|보증금|월세|전세|반려동물|애완|흡연|음식물|쓰레기|분양|청소|조경|화재|정전|단수|하수|오수|빗물|우수|세입자|집주인|임대인|임차인|특별수선충당금|장기수선|계량기|검침|엘레베이터/;
const EXTERNAL_TERMS = /날씨|환율|뉴스|주가|시세/;
const GREETING_ONLY = /^(안녕하세요|안녕|반가워|반갑습니다|하이|hi|hello)[.!?~]*$/i;
const GENERAL_PATTERNS = [/사용법|어떻게 사용|무엇을 할 수/, /\bRAG\b|검색증강|인공지능|AI란/];

export function classifyQuestion(message: string): QuestionRoute {
  const value = message.trim();
  // Pure external info requests (weather, stocks, etc.) without any housing context
  if (EXTERNAL_TERMS.test(value) && !HOUSING_TERMS.test(value)) return 'UNSUPPORTED_EXTERNAL';
  // Any housing-related keyword → always use RAG
  if (HOUSING_TERMS.test(value)) return 'RAG_REQUIRED';
  // Pure greetings only (no additional question content)
  if (GREETING_ONLY.test(value)) return 'GENERAL_ALLOWED';
  // Meta questions about the bot itself
  if (GENERAL_PATTERNS.some((pattern) => pattern.test(value))) return 'GENERAL_ALLOWED';
  // Default: attempt RAG search for any other question
  return 'RAG_REQUIRED';
}
