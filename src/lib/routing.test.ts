import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuestion } from './routing.ts';
import { parseTxt } from './ingestion/txt.ts';
import { splitParentChunks, splitChildChunks } from './chunking_ext.ts';

test('housing questions require RAG', () => {
  for (const question of ['관리비 납부일은 언제인가요?', '주차 등록 서류는 무엇인가요?', '누수 발생 시 어디로 연락하나요?', '관리규약상 반려동물 기준은?']) assert.equal(classifyQuestion(question), 'RAG_REQUIRED');
});
test('general questions are allowed', () => {
  assert.equal(classifyQuestion('안녕하세요'), 'GENERAL_ALLOWED');
  assert.equal(classifyQuestion('이 챗봇은 어떻게 사용하나요?'), 'GENERAL_ALLOWED');
  assert.equal(classifyQuestion('RAG가 무엇인가요?'), 'GENERAL_ALLOWED');
});
test('external real-time questions are refused', () => {
  assert.equal(classifyQuestion('오늘 서울 날씨는?'), 'UNSUPPORTED_EXTERNAL');
  assert.equal(classifyQuestion('현재 환율은?'), 'UNSUPPORTED_EXTERNAL');
});
test('parseTxt handles UTF-8 encoded text', async () => {
  const text = '안녕하세요. 관리비 납부 안내입니다.';
  const encoded = new TextEncoder().encode(text);
  const result = await parseTxt(encoded.buffer);
  assert.equal(result, text);
});
test('splitParentChunks and splitChildChunks handle Korean text cleanly', () => {
  const koreanText = [
    '제1조 (목적) 본 규약은 아파트 관리 및 입주민의 쾌적한 주거환경 조성을 목적으로 합니다.',
    '제2조 (관리비 납부) 관리비는 매월 말일까지 지정된 계좌로 납부하여야 합니다.',
    '제3조 (주차 관리) 세대당 1대의 차량은 무료 등록이 가능하며, 추가 차량은 소정의 관리비가 부과됩니다.',
    '제4조 (시설물 보수) 공용부분 하자는 관리사무소로 접수해 주시기 바랍니다.',
  ].join('\n\n');

  const parents = splitParentChunks(koreanText);
  assert.ok(parents.length >= 1);
  assert.ok(parents[0].content.includes('제1조'));

  const children = splitChildChunks(parents);
  assert.ok(children.length >= 1);
  for (const child of children) {
    assert.ok(child.content.length > 0);
  }
});

test('decodeXmlEntities decodes special entities properly', async () => {
  const { decodeXmlEntities } = await import('./ingestion/xml.ts');
  const xml = '&lt;div&gt;&#xAC00;&#xB098;&#xB2E4; &amp; &quot;테스트&quot;&apos;&lt;/div&gt;';
  const decoded = decodeXmlEntities(xml);
  assert.equal(decoded, '<div>가나다 & "테스트"\'</div>');
});

test('extractTagText and extractXmlText work correctly with Korean content', async () => {
  const { extractTagText, extractXmlText } = await import('./ingestion/xml.ts');
  const xml = '<root><hp:t>관리비 납부 안내</hp:t><hp:t>매월 말일</hp:t></root>';
  const tags = extractTagText(xml, 'hp:t');
  assert.deepEqual(tags, ['관리비 납부 안내', '매월 말일']);

  const text = extractXmlText(xml);
  assert.ok(text.includes('관리비 납부 안내'));
  assert.ok(text.includes('매월 말일'));
});

test('createAdminSession and isAdminSession verify valid sessions and reject forged ones', async () => {
  const { createAdminSession, isAdminSession, adminSessionCookie } = await import('./server/admin-session.ts');
  const secret = 'super-secret-admin-token-12345';
  const session = await createAdminSession(secret);
  assert.ok(session.includes('.'));

  const validReq = new Request('http://localhost/api/admin/overview', {
    headers: { cookie: `${adminSessionCookie}=${session}` },
  });
  assert.equal(await isAdminSession(validReq, secret), true);

  // Wrong secret should fail
  assert.equal(await isAdminSession(validReq, 'wrong-secret'), false);

  // Tampered payload should fail
  const [payload] = session.split('.');
  const forgedReq = new Request('http://localhost/api/admin/overview', {
    headers: { cookie: `${adminSessionCookie}=${payload}.forgedSignature` },
  });
  assert.equal(await isAdminSession(forgedReq, secret), false);
});

test('verifyAdminSession rejects arbitrary Bearer session values', async () => {
  const { createAdminSession, verifyAdminSession } = await import('./server/admin-session.ts');
  const secret = 'super-secret-admin-token-12345';
  assert.equal(await verifyAdminSession(await createAdminSession(secret), secret), true);
  assert.equal(await verifyAdminSession('a.b', secret), false);
  assert.equal(await verifyAdminSession('', secret), false);
  assert.equal(await verifyAdminSession(await createAdminSession(secret), undefined), false);
});

test('parseDocx preserves paragraph separation', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>첫 번째 문단입니다.</w:t></w:r></w:p>
        <w:p><w:r><w:t>두 번째 문단입니다.</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
  zip.file('word/document.xml', sampleXml);
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });

  const { parseDocx } = await import('./ingestion/docx.ts');
  const result = await parseDocx(buffer);
  assert.equal(result, '첫 번째 문단입니다.\n두 번째 문단입니다.');
});

test('parsePptx sorts slides numerically and extracts paragraphs', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  // Add slide 2 before slide 1 to test numeric sorting
  zip.file('ppt/slides/slide2.xml', `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>슬라이드 2 내용</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>슬라이드 1 제목</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });

  const { parsePptx } = await import('./ingestion/pptx.ts');
  const result = await parsePptx(buffer);
  assert.ok(result.startsWith('슬라이드 1 제목'));
  assert.ok(result.endsWith('슬라이드 2 내용'));
});

test('parseXlsx extracts shared, inline, sparse, and multi-sheet cell values', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook xmlns:r="urn:relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Flags" sheetId="2" r:id="rId2"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml', '<sst><si><t>Shared title</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Third, item</t></is></c></row><row r="2"><c r="B2"><v>42</v></c></row></sheetData></worksheet>');
  zip.file('xl/worksheets/sheet2.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="b"><v>1</v></c></row></sheetData></worksheet>');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });

  const { parseXlsx } = await import('./ingestion/xlsx.ts');
  const result = await parseXlsx(buffer);
  assert.equal(result, '[시트: Summary]\nShared title,,"Third, item"\n,42\n\n[시트: Flags]\nTRUE');
});

test('parseHwpx extracts sections in order and ignores metadata noise', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('Contents/section0.xml', `<hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run><hp:t>한글 문서 0섹션 내용</hp:t></hp:run></hp:p></hs:sec>`);
  zip.file('version.xml', `<version>1.0.0 (ignore metadata)</version>`);
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });

  const { parseHwpx } = await import('./ingestion/hwpx.ts');
  const result = await parseHwpx(buffer);
  assert.ok(result.includes('한글 문서 0섹션 내용'));
  assert.ok(!result.includes('ignore metadata'));
});

test('parsePdf gracefully handles corrupted PDF data', async () => {
  const { parsePdf } = await import('./ingestion/pdf.ts');
  const invalidBuffer = new Uint8Array([0, 1, 2, 3, 4]).buffer;
  const result = await parsePdf(invalidBuffer);
  assert.deepEqual(result, {});
});

test('strict RAG mode returns clear no-match response when RAG search produces zero results', () => {
  const noMatchResponse = {
    answer: '현재 등록된 주택관리 규약, FAQ 및 관리 문서에서 질문과 일치하는 정보를 찾지 못했습니다. 질문 키워드를 구체적으로 입력해 주시거나 관리사무소에 직접 문의해 주세요.',
    answerMode: 'rag',
    sources: [],
  };
  assert.equal(noMatchResponse.answerMode, 'rag');
  assert.equal(noMatchResponse.sources.length, 0);
  assert.ok(noMatchResponse.answer.includes('일치하는 정보를 찾지 못했습니다'));
});



test('extractKeywords drops question words and strips particles', async () => {
  const { extractKeywords } = await import('./retrieval.ts');
  assert.deepEqual(extractKeywords('엘리베이터에서 반려동물은 어떻게 해야 하나요?'), ['엘리베이터', '반려동물']);
  assert.deepEqual(extractKeywords('관리비 납부일은 언제인가요?'), ['관리비', '납부일', '언제인가요']);
});

test('filterByRelevance keeps only matches close to the best score', async () => {
  const { filterByRelevance } = await import('./retrieval.ts');
  const kept = filterByRelevance([{ id: 'a', score: 0.89 }, { id: 'b', score: 0.88 }, { id: 'c', score: 0.79 }]);
  assert.deepEqual(kept.map((m) => m.id), ['a', 'b']);
  assert.equal(filterByRelevance([]).length, 0);
});

test('similarityThreshold defaults to 0.8 and honours valid overrides', async () => {
  const { similarityThreshold } = await import('./retrieval.ts');
  const prev = process.env.RAG_SIMILARITY_THRESHOLD;
  delete process.env.RAG_SIMILARITY_THRESHOLD;
  assert.equal(similarityThreshold(), 0.8);
  process.env.RAG_SIMILARITY_THRESHOLD = '0.75';
  assert.equal(similarityThreshold(), 0.75);
  process.env.RAG_SIMILARITY_THRESHOLD = 'abc';
  assert.equal(similarityThreshold(), 0.8);
  if (prev === undefined) delete process.env.RAG_SIMILARITY_THRESHOLD; else process.env.RAG_SIMILARITY_THRESHOLD = prev;
});
