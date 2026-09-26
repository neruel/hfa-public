// HWPX parser implementation using JSZip.
// Prioritizes ordered section XML files (Contents/section*.xml) and extracts paragraph text (<hp:p> / <hp:t>).

import JSZip from 'jszip';
import { extractTagText, extractXmlText } from './xml.ts';

/**
 * Parse an HWPX file (ArrayBuffer) and return plain text in clean reading order.
 */
export async function parseHwpx(data: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const allFiles = Object.keys(zip.files);

    // 1. Look for section files (Contents/section0.xml, section1.xml, etc.)
    const sectionFiles = allFiles
      .filter((name) => /section\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/section(\d+)\.xml/i)?.[1] ?? '0', 10);
        const numB = parseInt(b.match(/section(\d+)\.xml/i)?.[1] ?? '0', 10);
        return numA - numB;
      });

    if (sectionFiles.length) {
      const sectionParagraphs: string[] = [];

      for (const fileName of sectionFiles) {
        const xmlStr = await zip.file(fileName)?.async('string') ?? '';
        if (!xmlStr) continue;

        const paragraphPattern = /<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/gi;
        const paragraphs: string[] = [];

        for (const match of xmlStr.matchAll(paragraphPattern)) {
          const textParts = extractTagText(match[1], 'hp:t');
          const text = textParts.join('').trim();
          if (text) paragraphs.push(text);
        }

        if (paragraphs.length) {
          sectionParagraphs.push(paragraphs.join('\n'));
        } else {
          // Fallback to all hp:t or hc:t in section
          const rawTexts = [...extractTagText(xmlStr, 'hp:t'), ...extractTagText(xmlStr, 'hc:t')];
          if (rawTexts.length) sectionParagraphs.push(rawTexts.join(' '));
          else {
            const fallbackText = extractXmlText(xmlStr);
            if (fallbackText) sectionParagraphs.push(fallbackText);
          }
        }
      }

      if (sectionParagraphs.length) {
        return sectionParagraphs.join('\n\n');
      }
    }

    // 2. Fallback for non-standard HWPX: filter out known metadata files
    const nonMetadataXml = allFiles.filter(
      (name) => name.endsWith('.xml') && !/version\.xml|settings\.xml|manifest\.xml|content\.hpf/i.test(name),
    );

    const fallbackTexts: string[] = [];
    for (const fileName of nonMetadataXml) {
      const xmlStr = await zip.file(fileName)?.async('string') ?? '';
      const text = extractXmlText(xmlStr);
      if (text) fallbackTexts.push(text);
    }

    return fallbackTexts.join('\n');
  } catch (error) {
    console.warn('HWPX parse error', error);
    return '';
  }
}

