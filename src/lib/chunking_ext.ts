export type PageSegment = { page: number; text: string };
type ParentChunk = { id: string; chunkIndex: number; content: string; pageNumber: number | null };
type ChildChunk = { id: string; parentId: string; chunkIndex: number; content: string; pageNumber: number | null };

function genId(): string {
  return crypto.randomUUID();
}

function findBestBoundary(text: string, start: number, limit: number): number {
  const minThreshold = start + (limit - start) * 0.5;
  const slice = text.slice(start, limit);

  // Priority boundary patterns in descending preference
  const patterns = [
    /\n\n+/g,
    /(?:[.\?!]|습니다|합니다|입니다|됩니다|바랍니다|오니|시오|해요|요)\n/g,
    /[.\?!]\s+/g,
    /\n/g,
  ];

  for (const pattern of patterns) {
    let lastMatchEnd = -1;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(slice)) !== null) {
      const matchPos = start + match.index + match[0].length;
      if (matchPos >= minThreshold && matchPos <= limit) {
        lastMatchEnd = matchPos;
      }
    }
    if (lastMatchEnd !== -1) return lastMatchEnd;
  }

  return limit;
}

function splitAtBoundary(text: string, start: number, maxLength: number): { content: string; end: number } {
  const limit = Math.min(start + maxLength, text.length);
  if (limit === text.length) return { content: text.slice(start).trim(), end: limit };
  const end = findBestBoundary(text, start, limit);
  return { content: text.slice(start, end).trim(), end };
}

/**
 * Build a lookup that maps a character offset in the joined text to its page number.
 * Each segment is joined with '\n', so offsets account for the separator.
 */
function buildPageOffsets(segments: PageSegment[]): Array<{ offset: number; page: number }> {
  const offsets: Array<{ offset: number; page: number }> = [];
  let cursor = 0;
  for (const seg of segments) {
    offsets.push({ offset: cursor, page: seg.page });
    cursor += seg.text.length + 1; // +1 for '\n' separator
  }
  return offsets;
}

function pageAtOffset(offsets: Array<{ offset: number; page: number }>, charOffset: number): number {
  let page = offsets[0]?.page ?? 1;
  for (const entry of offsets) {
    if (entry.offset > charOffset) break;
    page = entry.page;
  }
  return page;
}

export function splitParentChunks(text: string, pageSegments?: PageSegment[]): ParentChunk[] {
  const parents: ParentChunk[] = [];
  const offsets = pageSegments?.length ? buildPageOffsets(pageSegments) : null;
  let start = 0;
  while (start < text.length) {
    const { content, end } = splitAtBoundary(text, start, 1800);
    if (content) {
      const pageNumber = offsets ? pageAtOffset(offsets, start) : null;
      parents.push({ id: genId(), chunkIndex: parents.length, content, pageNumber });
    }
    if (end >= text.length) break;
    start = Math.max(end - 180, start + 1);
  }
  return parents;
}

export function splitChildChunks(parents: ParentChunk[]): ChildChunk[] {
  const children: ChildChunk[] = [];
  for (const parent of parents) {
    let start = 0;
    let childIndex = 0;
    while (start < parent.content.length) {
      const { content, end } = splitAtBoundary(parent.content, start, 350);
      if (content) children.push({ id: genId(), parentId: parent.id, chunkIndex: childIndex++, content, pageNumber: parent.pageNumber });
      if (end >= parent.content.length) break;
      start = Math.max(end - 50, start + 1);
    }
  }
  return children;
}
