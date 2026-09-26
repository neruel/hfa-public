// Captures README screenshots against a local production build.
// All API calls are intercepted with fictional housing FAQ fixtures, so no Supabase/Groq keys are used.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/screenshots';
const nextBin = 'node_modules/next/dist/bin/next';
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-role-key',
  GROQ_API_KEY: 'dummy-groq-key',
  GEMINI_API_KEY: 'dummy-gemini-key',
  ADMIN_API_TOKEN: 'test-admin-token',
};

const chatFixture = {
  answer:
    '관리비는 매월 25일까지 납부하시면 됩니다. 관리규약 제12조에 따라 납부 기한이 지나면 미납 금액에 연체료가 부과되며, 자동이체를 신청하면 매월 25일에 등록한 계좌에서 자동으로 출금됩니다.\n\n자동이체는 관리사무소 방문 또는 입주민 포털에서 신청할 수 있습니다.',
  answerMode: 'rag',
  sources: [
    { documentId: 'doc-1', documentName: '가상아파트 관리규약.pdf', chunkId: 'c-1', pageNumber: 7, sectionTitle: '제12조 관리비 납부', excerpt: '관리비는 매월 25일까지 관리주체가 지정한 계좌로 납부한다. 기한 내 납부하지 않은 경우 연체료를 부과한다.' },
    { documentId: 'faq-3', documentName: '주택관리 FAQ (관리비)', chunkId: 'faq-3', pageNumber: null, sectionTitle: '자동이체 신청 방법', excerpt: '관리사무소 방문 또는 입주민 포털의 [관리비] 메뉴에서 자동이체를 신청할 수 있습니다.' },
  ],
};

const searchFixture = {
  results: [
    { id: 's-1', documentId: 'doc-2', documentName: '가상아파트 주차장 운영 안내.pdf', chunkId: 's-1', pageNumber: 2, sectionTitle: '입주민 차량 등록', excerpt: '입주민 차량은 세대당 1대까지 무료 등록할 수 있습니다. 차량 등록증과 신분증을 지참하여 관리사무소에 신청하면 당일 등록됩니다.', score: 0.91 },
    { id: 's-2', documentId: 'doc-2', documentName: '가상아파트 주차장 운영 안내.pdf', chunkId: 's-2', pageNumber: 3, sectionTitle: '방문 차량', excerpt: '방문 차량은 경비실 또는 입주민 포털에서 사전 등록하면 최대 24시간 주차할 수 있습니다.', score: 0.86 },
    { id: 's-3', documentId: 'doc-1', documentName: '가상아파트 관리규약.pdf', chunkId: 's-3', pageNumber: 15, sectionTitle: '제31조 주차장 이용', excerpt: '두 번째 차량부터는 월 주차 요금을 관리비와 함께 부과한다. 요금은 입주자대표회의에서 정한다.', score: 0.83 },
  ],
};

const now = '2026-09-20T09:00:00.000Z';
const documents = [
  { id: 'doc-1', filename: '가상아파트 관리규약.pdf', file_type: 'application/pdf', status: 'READY', ocr_used: false, chunk_count: 48, created_at: now, updated_at: now, error_message: null },
  { id: 'doc-2', filename: '가상아파트 주차장 운영 안내.pdf', file_type: 'application/pdf', status: 'READY', ocr_used: false, chunk_count: 12, created_at: now, updated_at: now, error_message: null },
  { id: 'doc-3', filename: '2026 하반기 시설 점검 일정.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'EMBEDDING', ocr_used: false, chunk_count: 0, created_at: now, updated_at: now, error_message: null },
  { id: 'doc-4', filename: '스캔본 입주 안내문.pdf', file_type: 'application/pdf', status: 'ERROR', ocr_used: true, chunk_count: 0, created_at: now, updated_at: now, error_message: 'OCR 결과에서 텍스트를 찾지 못했습니다.' },
];

async function mockApis(page) {
  await page.route('**/api/chat', (route) => route.fulfill({ json: chatFixture }));
  await page.route('**/api/search?*', (route) => route.fulfill({ json: searchFixture }));
  await page.route('**/api/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/overview')) return route.fulfill({ json: { overview: { totalDocuments: 4, readyDocuments: 2, errorDocuments: 1 } } });
    if (path.endsWith('/documents')) return route.fulfill({ json: { documents } });
    return route.fulfill({ json: { ok: true } });
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${BASE}/chat`);
      return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Next.js server did not start');
}

async function shootChat(page, file) {
  await page.goto(`${BASE}/chat`);
  await page.getByLabel('채팅 입력').fill('관리비 납부일은 언제인가요?');
  await page.getByLabel('메시지 전송').click();
  await page.getByText('가상아파트 관리규약.pdf').first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${file}` });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (process.env.SKIP_BUILD !== '1') {
    const build = spawnSync(process.execPath, [nextBin, 'build'], { stdio: 'inherit', env });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], { stdio: 'ignore', env });
  const browser = await chromium.launch();
  try {
    await waitForServer();
    const desktop = { viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'ko-KR' };

    const light = await browser.newContext(desktop);
    await light.addInitScript(() => localStorage.setItem('theme', 'light'));
    const page = await light.newPage();
    await mockApis(page);

    await shootChat(page, 'chat.png');

    await page.goto(`${BASE}/search`);
    await page.getByLabel('검색어').fill('주차 등록');
    await page.getByLabel('검색어').press('Enter');
    await page.getByText('검색 결과 3건').waitFor();
    await page.screenshot({ path: `${OUT}/search.png` });

    await page.goto(`${BASE}/admin`);
    await page.getByText('업로드한 문서').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/admin.png` });
    await light.close();

    const dark = await browser.newContext({ ...desktop, colorScheme: 'dark' });
    await dark.addInitScript(() => localStorage.setItem('theme', 'dark'));
    const darkPage = await dark.newPage();
    await mockApis(darkPage);
    await shootChat(darkPage, 'dark.png');
    await dark.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'ko-KR' });
    await mobile.addInitScript(() => localStorage.setItem('theme', 'light'));
    const mobilePage = await mobile.newPage();
    await mockApis(mobilePage);
    await shootChat(mobilePage, 'mobile.png');
    await mobile.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`Screenshots saved to ${OUT}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
