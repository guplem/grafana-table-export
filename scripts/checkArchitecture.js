/**
 * The architecture check. It enforces the module boundaries that AGENTS.md describes:
 *
 * - `src/page/` holds classic page scripts. Chrome runs them in the page world (MAIN), where no `chrome.*`
 *   API exists and no `import` works.
 * - `src/shared/` is pure logic: no `chrome.*` and no DOM, so Node tests it.
 * - `src/popup/` and `src/background/` import only from `src/shared/`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {object} Rule
 * @property {string} folder A folder under `src/`.
 * @property {RegExp[]} forbidden Code patterns that no file in the folder may hold.
 * @property {string} reason
 */

const IMPORT = /^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

/** @type {Rule[]} */
const RULES = [
  { folder: 'page', forbidden: [/\bchrome\./, /^\s*(?:import|export)\s/m], reason: 'a page script runs in the page world' },
  { folder: 'shared', forbidden: [/\bchrome\.\w+\(/, /\bdocument\./, /\bwindow\./], reason: 'shared logic is pure' },
];

/** The only folder that `src/popup/` and `src/background/` may import from. */
const SHARED_IMPORT = /^\.\.\/shared\/[\w.]+\.js$/;

/**
 * @param {string} folder
 * @returns {string[]}
 */
function jsFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

/**
 * @param {string} root The repository root.
 * @returns {string[]} One message for each broken rule.
 */
export function architectureProblems(root) {
  /** @type {string[]} */
  const problems = [];
  /** @param {string} file */
  const name = (file) => relative(root, file).split(sep).join('/');
  const source = join(root, 'src');
  for (const rule of RULES) {
    for (const file of jsFiles(join(source, rule.folder))) {
      const code = readFileSync(file, 'utf8');
      for (const pattern of rule.forbidden) {
        if (pattern.test(code)) problems.push(`${name(file)}: matches ${pattern}, but ${rule.reason}.`);
      }
    }
  }
  for (const folder of ['popup', 'background']) {
    for (const file of jsFiles(join(source, folder))) {
      for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        const target = match[1] ?? match[2] ?? '';
        if (!SHARED_IMPORT.test(target)) problems.push(`${name(file)}: imports ${target}, but may import only src/shared/.`);
      }
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const problems = architectureProblems(process.cwd());
  if (problems.length > 0) {
    process.stderr.write(`The architecture check failed:\n${problems.map((problem) => `  ${problem}\n`).join('')}`);
    process.exit(1);
  }
  process.stdout.write('The modules keep their boundaries.\n');
}
