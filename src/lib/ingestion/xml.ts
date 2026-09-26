/** Small XML text helpers for extracting text from office documents. */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

export function extractTagText(xml: string, tagName: string): string[] {
  const escapedTag = tagName.replace(':', '\\:');
  const pattern = new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)</${escapedTag}>`, 'gi');
  return [...xml.matchAll(pattern)]
    .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function extractXmlText(xml: string): string {
  return decodeXmlEntities(xml.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
