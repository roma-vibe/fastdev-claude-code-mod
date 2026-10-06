// Validates the mod the way the engine loads it. A module the engine refuses
// does not load at all, in any session, so this is part of `npm run check`.
//
// Warnings fail the check too (like `--strict`), except the one about CLAUDE.md:
// the project keeps a CLAUDE.md for the agents that work on the mod, and it is
// not part of what the mod ships.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findClaude } from './claude.ts';

const IGNORED = [/CLAUDE\.md at the plugin root/];

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run = spawnSync(findClaude(), ['plugin', 'validate', '.'], { cwd: root, encoding: 'utf8' });
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);

/** The `❯` lines of every “Found N warning(s)” block of the output. */
function warnings(output: string): string[] {
  const found: string[] = [];
  let inWarnings = false;
  for (const line of output.split('\n')) {
    if (/Found \d+ warning/.test(line)) inWarnings = true;
    else if (/^\s*(Validating|✔|✘)/.test(line)) inWarnings = false;
    else if (inWarnings && /^\s*❯/.test(line)) found.push(line);
  }
  return found;
}

const blocking = warnings(`${run.stdout}\n${run.stderr}`).filter((line) => !IGNORED.some((re) => re.test(line)));
if (blocking.length > 0) {
  process.stderr.write(`\n✘ Warnings fail the check (${blocking.length}).\n`);
  process.exit(1);
}
process.exit(run.status ?? 1);
