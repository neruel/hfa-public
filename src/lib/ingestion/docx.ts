// DOCX parser implementation using JSZip
// Extracts text preserving paragraph boundaries (<w:p>) and lines.

import JSZip from 'jszip';
import { decodeXmlEntities, extractTagText } from './xml.ts';

/**
 * Parse a DOCX file (ArrayBuffer) and return plain text with preserved paragraphs.
 * Extracts DOCX text with JSZip and the shared XML helpers.
 */
export async function parseDocx(data: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file('word/document.xml')?.async('string') ?? '';
    if (!docXml) return '';

    // Match each paragraph <w:p>...</w:p>
    const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
    const paragraphs: string[] = [];

    for (const match of docXml.matchAll(paragraphPattern)) {
      const paragraphXml = match[1];
      const textParts = extractTagText(paragraphXml, 'w:t');
      const paragraphText = textParts.join('').trim();
      if (paragraphText) {
        paragraphs.push(paragraphText);
      }
    }

    if (paragraphs.length) return paragraphs.join('\n');

    // Fallback: extract all w:t tags directly if w:p wrapping is absent
    const allTexts = extractTagText(docXml, 'w:t');
    return allTexts.join(' ');
  } catch (error) {
    console.warn('DOCX parse error', error);
    return '';
  }
}

