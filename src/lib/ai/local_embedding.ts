import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for server environments
env.allowLocalModels = false;

export const LOCAL_EMBED_DIMENSION = 384;

// Singleton pattern to reuse the pipeline instance across invocations
class PipelineSingleton {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/multilingual-e5-small';
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

/**
 * Generate 384-dimensional embedding for a single text using Xenova/multilingual-e5-small.
 */
export async function embedLocalSingle(text: string, isQuery = false): Promise<number[]> {
  try {
    const extractor = await PipelineSingleton.getInstance();
    const formatted = isQuery ? `query: ${text}` : `passage: ${text}`;
    const output = await extractor(formatted, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data) as number[];

    if (vector.length !== LOCAL_EMBED_DIMENSION) {
      throw new Error(`Local embedding dimension mismatch: expected ${LOCAL_EMBED_DIMENSION}, got ${vector.length}`);
    }

    return vector;
  } catch (err) {
    console.error('Local embedding error:', err);
    throw err;
  }
}

/**
 * Batch generate 384-dimensional embeddings for an array of texts.
 */
export async function embedLocalBatch(texts: string[], isQuery = false): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const vec = await embedLocalSingle(text, isQuery);
    results.push(vec);
  }
  return results;
}
