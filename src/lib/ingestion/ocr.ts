/**
 * Free Multimodal OCR using Google Gemini 1.5 Flash Vision API.
 * Accepts ArrayBuffer of a scanned PDF or image and extracts all text.
 */

function getApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export async function performPdfOcr(pdfBuffer: ArrayBuffer): Promise<{ text: string; ocrUsed: boolean }> {
  const apiKeys = getApiKeys();
  if (!apiKeys.length) {
    console.warn('GEMINI_API_KEY not configured. OCR fallback skipped.');
    return { text: '', ocrUsed: false };
  }

  // Convert ArrayBuffer to base64 string natively
  const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: '이 스캔 PDF 문서 이미지에 있는 모든 한국어, 숫자, 표, 문장 텍스트를 정확하게 추출해 주세요. 부연 설명이나 다른 문장 없이 오직 문서에서 추출한 순수 텍스트 내용만 출력하세요.',
          },
        ],
      },
    ],
  };

  const envOcrModel = process.env.GEMINI_OCR_MODEL;
  const candidateModels = envOcrModel
    ? [envOcrModel, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite']
    : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];

  for (const model of candidateModels) {
    for (const apiKey of apiKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`Gemini OCR error with ${model} (${resp.status}):`, errText.slice(0, 150));
          continue;
        }

        const json = (await resp.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const extractedText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (extractedText.trim()) {
          console.log(`Successfully extracted OCR text using ${model}!`);
          return { text: extractedText.trim(), ocrUsed: true };
        }
      } catch (err) {
        console.warn(`Gemini Flash OCR request with ${model} failed:`, err);
      }
    }
  }

  return { text: '', ocrUsed: false };
}
