/**
 * Fails when a commit of this branch has no conventional-commit subject. The release workflow reads
 * these subjects to pick each version, so a bad one would pick the wrong version.
 * It checks the commits that `origin/main` does not have yet.
 */

import { spawnSync } from 'node:child_process';

import { isConventionalSubject } from './release/releaseVersion.js';

const base = 'origin/main';

/**
 * @param {string[]} args
 * @returns {{ ok: boolean, stdout: string }}
 */
function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return { ok: result.status === 0, stdout: result.stdout ?? '' };
}

if (!git(['rev-parse', '--verify', '--quiet', base]).ok) {
  process.stdout.write(`No ${base} to compare with. The commit check is skipped.\n`);
  process.exit(0);
}

const bad = git(['log', '--no-merges', '--format=%h %s', `${base}..HEAD`])
  .stdout.split(/\r?\n/)
  .filter((line) => line.length > 0)
  .filter((line) => !isConventionalSubject(line.slice(line.indexOf(' ') + 1)));

if (bad.length > 0) {
  process.stderr.write(
    'These commits have no conventional-commit subject, such as `feat: ...` or `fix!: ...`.\n' +
      'Follow .agents/skills/write-commit/SKILL.md.\n' +
      bad.map((line) => `  ${line}\n`).join(''),
  );
  process.exit(1);
}
process.stdout.write('Each commit has a conventional-commit subject.\n');
