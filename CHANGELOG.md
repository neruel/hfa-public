# Changelog

## 5.0.2

### 보안
- 관리자 로그인 응답 본문에서 세션 값을 제거했습니다. 세션은 HttpOnly 쿠키로만 전달합니다.
- 관리자 토큰 비교를 SHA-256 해시 후 `crypto.timingSafeEqual`로 수행하는 상수 시간 비교로 변경했습니다.
- 관리자 대시보드가 `Authorization: Bearer session:` 헤더 대신 쿠키(`credentials: "include"`)로만 인증합니다.

### 테스트
- `npm test`가 tsx로 `src/**/*.test.ts`를 실제로 실행하도록 변경했습니다(Node 20 지원).

### 설정
- `.env.example`을 README의 모든 환경변수를 담은 빈 값 템플릿으로 정리했습니다.
- `.gitignore`가 `.env.example`을 제외한 모든 `.env*` 파일을 무시합니다.

### CI
- GitHub Actions 워크플로를 추가했습니다(Node 20, lint → typecheck → test → build, dummy env, `contents: read`).
- `actions/checkout`, `actions/setup-node`를 v5로 올려 Actions 런타임의 Node 20 사용 중단 경고를 없앴습니다.

### 스크린샷
- Playwright 기반 `npm run screenshots`를 추가하고, mock fixture로 촬영한 채팅·색인 검색(관리자 탭)·관리자·모바일·다크 테마 화면을 `docs/screenshots/`에 포함했습니다.

### 문서
- README에 CI 배지, 버전, 스크린샷 표, 검증 방식 섹션을 추가하고 `/search` 경로 설명을 실제 메뉴 구성에 맞췄습니다.
