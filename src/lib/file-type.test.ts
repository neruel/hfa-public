import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFileType } from './file-type.ts';

test('formatFileType maps known MIME types to short labels', () => {
  assert.equal(formatFileType('application/pdf', 'a.pdf'), 'PDF');
  assert.equal(formatFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'DOCX');
  assert.equal(formatFileType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'XLSX');
  assert.equal(formatFileType('application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'PPTX');
  assert.equal(formatFileType('application/hwp+zip', 'a.hwpx'), 'HWPX');
  assert.equal(formatFileType('text/plain'), 'TXT');
});

test('formatFileType falls back to the extension, then to a generic label', () => {
  assert.equal(formatFileType('application/octet-stream', '안내문.hwpx'), 'HWPX');
  assert.equal(formatFileType(null, 'notes.txt'), 'TXT');
  assert.equal(formatFileType('pdf', 'x'), 'PDF');
  assert.equal(formatFileType('', 'README'), '파일');
  assert.equal(formatFileType(undefined), '파일');
});
