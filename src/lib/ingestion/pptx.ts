// PPTX parser implementation using JSZip.
// Sorts slide XML files in numeric order and extracts paragraph-level text (<a:p> / <a:t>).

import JSZip from 'jszip';
import { extractTagText } from './xml.ts';

/**
 * Parse a PPTX file (ArrayBuffer) and return plain text in correct slide sequence.
 */
export async function parsePptx(data: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] ?? '0', 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] ?? '0', 10);
        return numA - numB;
      });

    const slides: string[] = [];

    for (const fileName of slideFiles) {
      const xmlStr = await zip.file(fileName)?.async('string') ?? '';
      if (!xmlStr) continue;

      const paragraphPattern = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
      const paragraphs: string[] = [];

      for (const match of xmlStr.matchAll(paragraphPattern)) {
        const textParts = extractTagText(match[1], 'a:t');
        const text = textParts.join('').trim();
        if (text) paragraphs.push(text);
      }

      if (paragraphs.length) {
        slides.push(paragraphs.join('\n'));
      } else {
        const fallbackTexts = extractTagText(xmlStr, 'a:t');
        if (fallbackTexts.length) slides.push(fallbackTexts.join(' '));
      }
    }

    return slides.join('\n\n');
  } catch (error) {
    console.warn('PPTX parse error', error);
    return '';
  }
}

