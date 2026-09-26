const mimeLabels: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/hwp+zip': 'HWPX',
  'application/haansofthwpx': 'HWPX',
  'application/vnd.hancom.hwpx': 'HWPX',
  'text/plain': 'TXT',
};

/** Converts a stored MIME type into a short label such as PDF or DOCX for display. */
export function formatFileType(fileType: string | null | undefined, filename?: string): string {
  const value = fileType?.trim() ?? '';
  const known = mimeLabels[value.toLowerCase()];
  if (known) return known;
  // Values without a slash are already short labels (e.g. the server's extension fallback).
  if (value && !value.includes('/')) return value.toUpperCase();
  const extension = filename?.includes('.') ? filename.split('.').pop()?.trim() : '';
  return extension ? extension.toUpperCase() : '파일';
}
