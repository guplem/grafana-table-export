import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { architectureProblems } from '../scripts/checkArchitecture.js';

test('this repository keeps its module boundaries', () => {
  assert.deepEqual(architectureProblems(fileURLToPath(new URL('..', import.meta.url))), []);
});

test('the check finds a broken boundary in each module', () => {
  const root = mkdtempSync(join(tmpdir(), 'architecture-'));
  try {
    /** @type {Record<string, string>} */
    const files = {
      'src/page/a.js': 'chrome.runtime.sendMessage({});',
      'src/shared/b.js': 'export const x = document.title;',
      'src/popup/c.js': "import { y } from '../page/a.js';",
      'src/background/d.js': "import '../shared/b.js';",
    };
    for (const [path, code] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), code);
    }
    const problems = architectureProblems(root).join('\n');
    assert.ok(problems.includes('src/page/a.js: matches'), problems);
    assert.ok(problems.includes('src/shared/b.js: matches'), problems);
    assert.ok(problems.includes('src/popup/c.js: imports ../page/a.js'), problems);
    assert.doesNotMatch(problems, /background/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
