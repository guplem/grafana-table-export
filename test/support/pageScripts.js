/**
 * Loads page scripts the way Chrome loads them: classic scripts, in order, in one shared global scope.
 * A page script declares its API as a global constant, so a test reads it from the returned context.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));

/**
 * @param {readonly string[]} files Paths from the repository root, such as `src/page/exportFormats.js`.
 * @param {string} globalName The constant to read, such as `GrafanaTableExportFormats`.
 * @returns {any}
 */
export function loadPageScripts(files, globalName) {
  const context = vm.createContext({ console, URL, Date, JSON });
  for (const file of files) {
    const path = root + file;
    new vm.Script(readFileSync(path, 'utf8'), { filename: path }).runInContext(context);
  }
  return new vm.Script(globalName).runInContext(context);
}

/**
 * A page script builds its objects in the vm context, with that context's `Array` and `Object`.
 * `assert.deepEqual` compares prototypes, so compare a plain copy.
 * @param {unknown} value
 * @returns {any}
 */
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
