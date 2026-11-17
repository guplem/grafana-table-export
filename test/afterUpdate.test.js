import assert from 'node:assert/strict';
import { test } from 'node:test';

import { afterUpdate } from '../scripts/afterUpdate.js';

/**
 * @param {readonly string[] | null} changed
 * @returns {{ calls: string[], steps: import('../scripts/afterUpdate.js').AfterUpdateSteps }}
 */
function recorder(changed) {
  /** @type {string[]} */
  const calls = [];
  return {
    calls,
    steps: {
      changedPaths: () => changed,
      install: () => void calls.push('install'),
      syncSkills: () => void calls.push('sync'),
    },
  };
}

test('a changed lockfile installs the dependencies, then copies the skills', () => {
  const { calls, steps } = recorder(['package-lock.json', 'src/a.js']);
  afterUpdate('abc', 'def', steps);
  assert.deepEqual(calls, ['install', 'sync']);
});

test('an unchanged lockfile only copies the skills', () => {
  const { calls, steps } = recorder(['src/a.js']);
  afterUpdate('abc', 'def', steps);
  assert.deepEqual(calls, ['sync']);
});

test('a new clone or unknown changes install too', () => {
  for (const [from, changed] of /** @type {const} */ ([
    ['0000000', []],
    [undefined, []],
    ['abc', null],
  ])) {
    const { calls, steps } = recorder(changed);
    afterUpdate(from, 'def', steps);
    assert.deepEqual(calls, ['install', 'sync']);
  }
});
