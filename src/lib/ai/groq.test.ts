import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from './groq.ts';

test('generate sends a chat completion request and removes Han characters from the answer', async () => {
  const previousFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  let authorization = '';
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return Response.json({ choices: [{ message: { content: '관리 안내입니다 漢字' } }] });
  };

  try {
    const answer = await generate('관리비 질문', {
      GROQ_API_KEY: 'test-api-key',
      GROQ_CHAT_MODEL: 'llama-3.3-70b-versatile',
    });
    assert.equal(answer, '관리 안내입니다');
    assert.equal(authorization, 'Bearer test-api-key');
    assert.equal(requestBody?.model, 'llama-3.3-70b-versatile');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('generate retries without an unsupported reasoning option', async () => {
  const previousFetch = globalThis.fetch;
  const requestBodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requestBodies.push(body);
    if (requestBodies.length === 1) return new Response('unsupported reasoning_format', { status: 400 });
    return Response.json({ choices: [{ message: { content: '정상 답변입니다.' } }] });
  };

  try {
    const answer = await generate('질문', { GROQ_API_KEY: 'test-api-key', GROQ_CHAT_MODEL: 'qwen/qwen3.8-27b' });
    assert.equal(answer, '정상 답변입니다.');
    assert.equal(requestBodies.length, 2);
    assert.equal(requestBodies[0].reasoning_format, 'hidden');
    assert.equal(Object.hasOwn(requestBodies[1], 'reasoning_format'), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('generate rejects calls without an API key', async () => {
  // Isolate from the host environment so a configured key never triggers a real request.
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(generate('질문', { GROQ_API_KEY: '' }), /GROQ_API_KEY is not configured/);
  } finally {
    if (previousKey !== undefined) process.env.GROQ_API_KEY = previousKey;
  }
});
