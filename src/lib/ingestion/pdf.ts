import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Parse PDF bytes into a map of page number → extracted text.
 * Uses pdfjs-dist in a Node environment. Returns an object where each key
 * is the 1‑based page number and the value is the concatenated text for that page.
 */
export async function parsePdf(data: ArrayBuffer): Promise<Record<number, string>> {
  try {
    const uint8 = new Uint8Array(data);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pages: Record<number, string> = {};

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const strings = textContent.items.map((item: any) => (item.str as string).trim()).filter(Boolean);
      pages[i] = strings.join(' ');
    }

    // Fallback: If pdfjs extracted 0 text, attempt raw stream extraction for embedded text streams
    const allExtracted = Object.values(pages).join('').trim();
    if (!allExtracted) {
      const rawText = new TextDecoder('latin1').decode(uint8);
      const matches = rawText.match(/\(([^)]+)\)\s*Tj/g) || rawText.match(/\[([^\]]+)\]\s*TJ/g);
      if (matches && matches.length > 0) {
        const fallbackStrings = matches
          .map((m) => m.replace(/[\(\)\[\]]/g, '').replace(/Tj|TJ/g, '').trim())
          .filter(Boolean);
        if (fallbackStrings.length > 0) {
          pages[1] = fallbackStrings.join(' ');
        }
      }
    }

    return pages;
  } catch (error) {
    console.warn('PDF parse error:', error);
    return {};
  }
}
