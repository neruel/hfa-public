// Finds every *.test.ts under src/ and runs it with the Node test runner through tsx.
// Node 20 has no glob support in `node --test`, so the file list is built here.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function findTests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const files = findTests('src').sort();
if (files.length === 0) {
  console.error('No test files found under src/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
