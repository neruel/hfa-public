import { embedLocalSingle, embedLocalBatch, LOCAL_EMBED_DIMENSION } from './local_embedding';

export const GEMINI_EMBED_DIMENSION = LOCAL_EMBED_DIMENSION;

export type GeminiConfig = {
  GEMINI_API_KEY?: string;
  GEMINI_EMBED_MODEL?: string;
  GEMINI_EMBED_DIMENSION?: number;
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getApiKeys(conf?: GeminiConfig): string[] {
  const raw = conf?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function resolveConfig(conf?: GeminiConfig) {
  const keys = getApiKeys(conf);
  return {
    apiKeys: keys,
    model: conf?.GEMINI_EMBED_MODEL || process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2',
    dimension: Number(conf?.GEMINI_EMBED_DIMENSION || process.env.GEMINI_EMBED_DIMENSION || String(LOCAL_EMBED_DIMENSION)),
  };
}

export async function embedQuery(text: string, conf?: GeminiConfig, timeoutMs = 5000): Promise<number[]> {
  if (process.env.USE_GEMINI_EMBEDDINGS === 'true') {
    try {
      return await embedSingle(text, conf, timeoutMs);
    } catch {
      // Fallback to local open-source embedding on error
      return embedLocalSingle(text, true);
    }
  }
  return embedLocalSingle(text, true);
}

export async function embedDocument(text: string, conf?: GeminiConfig, timeoutMs = 8000): Promise<number[]> {
  if (process.env.USE_GEMINI_EMBEDDINGS === 'true') {
    try {
      return await embedSingle(text, conf, timeoutMs);
    } catch {
      return embedLocalSingle(text, false);
    }
  }
  return embedLocalSingle(text, false);
}

async function fetchWithRetry(
  url: string,
  body: object,
  apiKeys: string[],
  timeoutMs = 15000,
  maxRetries = 3
): Promise<Response> {
  if (!apiKeys.length) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let lastError: Error | null = null;

  for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
    const currentKey = apiKeys[keyIdx];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': currentKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (resp.status === 429) {
          const waitMs = Math.pow(2, attempt) * 1500 + Math.random() * 500;
          console.warn(`Gemini 429 Rate Limit (attempt ${attempt + 1}/${maxRetries + 1}). Waiting ${Math.round(waitMs)}ms...`);
          await delay(waitMs);
          continue;
        }

        return resp;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = new Error(`Gemini API request timed out after ${timeoutMs}ms`);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < maxRetries) {
          await delay(1000 * (attempt + 1));
        }
      }
    }
  }

  throw lastError || new Error('Gemini API request failed after retries');
}

type SingleEmbedResponse = {
  embedding?: { values: number[] };
  error?: { message: string; code?: number };
};

type BatchEmbedResponse = {
  embeddings?: Array<{ values: number[] }>;
  error?: { message: string; code?: number };
};

async function embedSingle(text: string, conf?: GeminiConfig, timeoutMs = 5000): Promise<number[]> {
  const { apiKeys, model, dimension } = resolveConfig(conf);
  const modelId = model.startsWith('models/') ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:embedContent`;

  const body = {
    model: modelId,
    content: { parts: [{ text }] },
    output_dimensionality: dimension,
  };

  const resp = await fetchWithRetry(url, body, apiKeys, timeoutMs);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini embedContent failed: ${resp.status} ${errText.slice(0, 300)}`);
  }

  const json = (await resp.json()) as SingleEmbedResponse;
  if (json.error) {
    throw new Error(`Gemini API error: ${json.error.message}`);
  }

  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length !== dimension) {
    throw new Error(`Embedding dimension mismatch: expected ${dimension}, got ${Array.isArray(values) ? values.length : 'invalid'}`);
  }

  return values;
}

export async function embedBatch(
  texts: string[],
  conf?: GeminiConfig,
  timeoutMs = 20000
): Promise<number[][]> {
  if (!texts.length) return [];

  if (process.env.USE_GEMINI_EMBEDDINGS === 'true') {
    try {
      return await embedGeminiBatch(texts, conf, timeoutMs);
    } catch {
      return embedLocalBatch(texts, false);
    }
  }
  return embedLocalBatch(texts, false);
}

async function embedGeminiBatch(
  texts: string[],
  conf?: GeminiConfig,
  timeoutMs = 20000
): Promise<number[][]> {

  const { apiKeys, model, dimension } = resolveConfig(conf);
  const modelId = model.startsWith('models/') ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:batchEmbedContents`;

  // Process in small batches of 15 with pacing delay
  const batchSize = 15;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const chunkTexts = texts.slice(i, i + batchSize);
    const requests = chunkTexts.map((text) => ({
      model: modelId,
      content: { parts: [{ text }] },
      output_dimensionality: dimension,
    }));

    const resp = await fetchWithRetry(url, { requests }, apiKeys, timeoutMs);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini batchEmbedContents failed: ${resp.status} ${errText.slice(0, 300)}`);
    }

    const json = (await resp.json()) as BatchEmbedResponse;
    if (json.error) {
      throw new Error(`Gemini API batch error: ${json.error.message}`);
    }

    const items = json.embeddings;
    if (!Array.isArray(items) || items.length !== chunkTexts.length) {
      throw new Error(`Batch embedding count mismatch: expected ${chunkTexts.length}, got ${items?.length ?? 0}`);
    }

    for (const item of items) {
      if (!Array.isArray(item.values) || item.values.length !== dimension) {
        throw new Error(`Batch embedding dimension mismatch: expected ${dimension}, got ${Array.isArray(item.values) ? item.values.length : 'invalid'}`);
      }
      allEmbeddings.push(item.values);
    }

    if (i + batchSize < texts.length) {
      await delay(600);
    }
  }

  return allEmbeddings;
}
