/**
 * The setup after a pull or a branch switch: install the dependencies when `package-lock.json` changed,
 * then copy the skills for Claude Code. The post-merge and post-checkout git hooks run it.
 * Usage: `node scripts/afterUpdate.js <from> <to>`.
 */

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { syncSkills } from './syncSkills.js';

/**
 * @typedef {object} AfterUpdateSteps
 * @property {(from: string, to: string) => readonly string[] | null} changedPaths `null` when git cannot tell.
 * @property {() => void} install
 * @property {() => void} syncSkills
 */

// A new worktree or clone gives an all-zero commit as `from`.
const NO_COMMIT = /^0+$/;

/**
 * @param {string | undefined} from
 * @param {string | undefined} to
 * @param {AfterUpdateSteps} steps
 */
export function afterUpdate(from, to, steps) {
  const known = from !== undefined && to !== undefined && !NO_COMMIT.test(from);
  const changed = known ? steps.changedPaths(from, to) : null;
  // Unknown changes install too: a new worktree has no dependencies yet.
  if (changed === null || changed.includes('package-lock.json')) steps.install();
  steps.syncSkills();
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {readonly string[] | null}
 */
function changedPaths(from, to) {
  const result = spawnSync('git', ['diff', '--name-only', from, to], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout
    .split('\n')
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [from, to] = process.argv.slice(2);
  afterUpdate(from, to, {
    changedPaths,
    // `npm ci` installs the lockfile as git has it, and never rewrites it.
    install: () => void spawnSync('npm', ['ci'], { stdio: 'inherit', shell: process.platform === 'win32' }),
    syncSkills: () => syncSkills(process.cwd()),
  });
}
