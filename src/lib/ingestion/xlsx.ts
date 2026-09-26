import JSZip from 'jszip';
import { posix } from 'node:path';
import { decodeXmlEntities, extractTagText, extractXmlText } from './xml.ts';

function parseAttributes(value: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of value.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes.set(match[1], decodeXmlEntities(match[2] ?? match[3] ?? ''));
  }
  return attributes;
}

function columnIndex(reference: string | undefined, fallback: number): number {
  const letters = reference?.match(/^[A-Z]+/i)?.[0].toUpperCase();
  if (!letters) return fallback;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function readCell(type: string | undefined, body: string, sharedStrings: string[]): string {
  if (type === 'inlineStr') return extractTagText(body, 't').join('').trim();
  const value = extractTagText(body, 'v')[0] ?? '';
  if (type === 's') return sharedStrings[Number(value)] ?? '';
  if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  if (type === 'e') return '';
  return value.trim();
}

async function readText(zip: JSZip, filePath: string): Promise<string | null> {
  const file = zip.file(filePath);
  return file ? file.async('string') : null;
}

/** Extracts plain text from each worksheet without the unmaintained `xlsx` package. */
export async function parseXlsx(data: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const entries = Object.values(zip.files);
    const expandedSize = entries.reduce((total, entry) => {
      const metadata = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
      return total + (metadata?.uncompressedSize ?? 0);
    }, 0);
    if (entries.length > 10_000 || expandedSize > 100 * 1024 * 1024) {
      throw new Error('XLSX archive exceeds the extraction limits');
    }

    const workbookXml = await readText(zip, 'xl/workbook.xml');
    const relationshipsXml = await readText(zip, 'xl/_rels/workbook.xml.rels');
    if (!workbookXml || !relationshipsXml) throw new Error('Invalid XLSX workbook structure');

    const relationships = new Map<string, string>();
    for (const match of relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
      const attributes = parseAttributes(match[1]);
      const id = attributes.get('Id');
      const target = attributes.get('Target');
      if (!id || !target || attributes.get('TargetMode') === 'External') continue;
      const resolved = target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join('xl', target));
      if (resolved.startsWith('xl/')) relationships.set(id, resolved);
    }

    const sharedStringsXml = await readText(zip, 'xl/sharedStrings.xml');
    const sharedStrings = sharedStringsXml
      ? [...sharedStringsXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map((match) => extractXmlText(match[1]))
      : [];

    const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)]
      .map((match) => {
        const attributes = parseAttributes(match[1]);
        return {
          name: attributes.get('name') ?? 'Sheet',
          relationshipId: attributes.get('r:id'),
        };
      })
      .filter((sheet) => sheet.relationshipId && relationships.has(sheet.relationshipId));

    const sheetTexts: string[] = [];
    for (const sheet of sheets) {
      const worksheetPath = relationships.get(sheet.relationshipId!);
      if (!worksheetPath) continue;
      const worksheetXml = await readText(zip, worksheetPath);
      if (!worksheetXml) continue;

      const rows: string[] = [];
      for (const rowMatch of worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
        const cells: string[] = [];
        let fallbackColumn = 0;
        for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
          const attributes = parseAttributes(cellMatch[1]);
          const index = columnIndex(attributes.get('r'), fallbackColumn);
          cells[index] = readCell(attributes.get('t'), cellMatch[2] ?? '', sharedStrings);
          fallbackColumn = index + 1;
        }
        while (cells.length && !cells[cells.length - 1]) cells.pop();
        if (cells.some((cell) => Boolean(cell?.trim()))) rows.push(cells.map((cell) => csvCell(cell ?? '')).join(','));
      }

      const csv = rows.join('\n').trim();
      if (csv) sheetTexts.push(sheets.length > 1 ? `[시트: ${sheet.name}]\n${csv}` : csv);
    }

    return sheetTexts.join('\n\n');
  } catch (error) {
    console.warn('XLSX parse error:', error instanceof Error ? error.message : error);
    return '';
  }
}
