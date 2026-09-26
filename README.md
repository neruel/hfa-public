# Housing FAQ Assistant

주택 관리 문서를 업로드하고, 문서 내용을 바탕으로 질문에 답하는 RAG 데모입니다.

## 구성

- **웹 앱:** Next.js App Router, React, TypeScript, Tailwind CSS
- **저장 및 검색:** Supabase PostgreSQL과 pgvector
- **임베딩:** 기본 설정은 `Xenova/multilingual-e5-small` 로컬 실행, 384차원
- **답변 생성:** Groq Chat Completions
- **스캔 PDF OCR:** 텍스트 추출에 실패하면 Google Gemini Vision 사용

```text
브라우저
  ├─ /api/chat ── 로컬 임베딩 ── Supabase 벡터 검색 및 FAQ 검색
  │                              └─ 검색 내용이 있을 때 Groq로 답변 생성
  ├─ /api/search ─ 로컬 임베딩 ── Supabase 벡터 검색
  └─ /api/admin ── 인증된 문서 업로드 및 관리
                                  ├─ Supabase Storage / PostgreSQL
                                  ├─ 문서 텍스트 추출 및 분할
                                  └─ 로컬 임베딩
                                      └─ 스캔 PDF에 한해 Gemini OCR
```

첫 임베딩 요청 때 로컬 임베딩 모델을 내려받습니다. 답변 생성에는 Groq API 키가 필요하고, 스캔 PDF OCR을 사용하려면 Gemini API 키가 필요합니다.

## 기능

- PDF, DOCX, HWPX, XLSX, PPTX, TXT 문서 업로드 및 색인
- 문서 검색 결과와 출처를 포함하는 RAG 채팅
- 관리자 로그인, 문서 상태 확인, 재처리 및 삭제
- 라이트·다크 테마와 모바일 화면 지원

기본 FAQ 샘플은 포함하지 않습니다. 채팅은 Supabase의 `faqs` 테이블에 사용자가 입력한 FAQ가 있으면 키워드 검색에 함께 사용합니다. 데모 문서와 FAQ를 등록하지 않은 새 DB에서는 검색할 지식이 없습니다.

## 시작하기

Node.js 20.9 이상이 필요합니다.

```powershell
npm install
Copy-Item .env.example .env.local
```

`.env.local`에 사용할 키를 입력한 뒤 개발 서버를 실행합니다.

```powershell
npm run dev
```

필수 연결 정보와 키:

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 DB 및 Storage 접근 키 |
| `GROQ_API_KEY` | 답변 생성 |
| `ADMIN_API_TOKEN` | 관리자 인증 |

선택 변수:

| 변수 | 용도 |
| --- | --- |
| `GROQ_CHAT_MODEL` | Groq 모델 지정 |
| `GEMINI_API_KEY` | 스캔 PDF OCR |
| `GEMINI_OCR_MODEL` | OCR 모델 지정 |
| `RAG_SIMILARITY_THRESHOLD` | 벡터 검색 유사도 기준 |

`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `ADMIN_API_TOKEN`은 서버 환경변수로만 설정해야 합니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. 프로덕션 관리자 API는 `ADMIN_API_TOKEN`이 설정되지 않으면 접근이 거부됩니다.

## Supabase 설정

새 Supabase 프로젝트에 `supabase/migrations/`의 SQL 파일을 파일명 순서대로 한 번 적용합니다. 적용 후 문서를 업로드하면 필요한 비공개 `documents` Storage 버킷을 생성합니다.

**기존 데이터가 있는 DB에 전체 SQL을 다시 실행하지 마세요.** 차원 변경 마이그레이션에는 `document_chunks`를 비우는 `TRUNCATE`가 포함되어 있습니다. 기존 DB를 변경해야 한다면 먼저 백업하고, 이미 적용한 마이그레이션은 다시 실행하지 마세요.

벡터 검색 API는 등록된 문서의 일부 내용을 반환합니다. 공개 데모를 배포할 때는 공개해도 되는 자료만 연결된 DB에 넣으세요. 코드 저장소에는 실제 Supabase 접속 설정이 포함되어 있지 않습니다.

## 주요 경로

- `/chat` — 문서 기반 채팅
- `/search` — 문서 검색
- `/call` — 공개 데모 연락처 안내
- `/admin` — 관리자 로그인 및 문서 관리
- `/api/health` — 상태 확인
- `/api/chat`, `/api/search` — 사용자용 RAG API
- `/api/admin/*` — 관리자 API

## DB 마이그레이션 파일

1. `20240901000000_create_tables.sql` — 테이블, 트리거, 초기 벡터 인덱스
2. `20240901000100_create_rpc_functions.sql` — 벡터 검색 및 청크 관리 함수
3. `20240901000200_migrate_to_gemini_embedding.sql` — 기존 임베딩 차원 변경 이력
4. `20240902000000_improve_vector_search.sql` — 최종 384차원 벡터와 HNSW 검색 인덱스

## 점검 명령

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
