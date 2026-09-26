/**
 * Thin wrapper around Groq Chat Completions API.
 * API Endpoint: https://api.groq.com/openai/v1/chat/completions
 * Recommended Model: qwen/qwen3.8-27b
 */

export type GroqConfig = {
  GROQ_API_KEY?: string;
  GROQ_CHAT_MODEL?: string;
};

const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

function resolveConfig(conf?: GroqConfig) {
  return {
    apiKey: conf?.GROQ_API_KEY || process.env.GROQ_API_KEY,
    model: conf?.GROQ_CHAT_MODEL || process.env.GROQ_CHAT_MODEL || DEFAULT_MODEL,
  };
}

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
  };
};

export async function generate(
  prompt: string,
  conf?: GroqConfig,
  timeoutMs = 15000
): Promise<string> {
  const apiKey = conf?.GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const primaryModel = conf?.GROQ_CHAT_MODEL || process.env.GROQ_CHAT_MODEL || DEFAULT_MODEL;
  const candidateModels = [
    primaryModel,
    DEFAULT_MODEL,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const payload: Record<string, any> = {
      model,
      messages: [
        {
          role: 'system',
          content: '당신은 아파트 생활 및 주택관리 AI 도우미입니다. 한자(漢字)나 중국어를 절대 사용하지 마시고 100% 순수 한국어(한글)로 자연스럽게 답변하세요. 문장이 도중에 끊기지 않도록 완전한 문장으로 마무리하세요.',
        },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 1024,
      temperature: 0.2,
    };

    // Reasoning models: hide reasoning / keep it short so the answer fits the token budget
    if (model.includes('qwen') || model.includes('qwq')) {
      payload.reasoning_format = 'hidden';
    } else if (model.includes('gpt-oss')) {
      payload.reasoning_effort = 'low';
    }

    try {
      let resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Fallback if a reasoning parameter is rejected
      if (!resp.ok && resp.status === 400 && (payload.reasoning_format || payload.reasoning_effort)) {
        delete payload.reasoning_format;
        delete payload.reasoning_effort;
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }

      // If 429 Rate Limit, log warning and fallback to next model
      if (resp.status === 429) {
        const errText = await resp.text();
        console.warn(`Groq model ${model} hit 429 rate limit. Trying fallback model... (${errText.slice(0, 100)})`);
        lastError = new Error(`Groq 429 rate limit on ${model}`);
        continue;
      }

      if (!resp.ok) {
        const errText = (await resp.text()).slice(0, 300);
        throw new Error(`Groq generate failed (${model}): ${resp.status} ${errText}`);
      }

      const json = (await resp.json()) as ChatResponse;
      if (json.error) {
        throw new Error(`Groq API error (${model}): ${json.error.message}`);
      }

      let answer = json.choices?.[0]?.message?.content;
      if (!answer) {
        throw new Error(`Groq returned no content (${model})`);
      }

      // Sanitize any accidental Chinese characters (Hanja)
      answer = answer.replace(/[\u4e00-\u9fa5]/g, '').trim();

      return answer;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new Error(`Groq request timed out after ${timeoutMs}ms (${model})`);
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('All Groq candidate models failed');
}
