// Writes Claude Code's TypeScript declarations (the `claude-code` module) into
// .claude/types, which tsconfig.json includes. The engine generates them for
// the Claude Code version you run, so they are not committed: run this after
// installing or updating Claude Code (`npm run types`).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findClaude } from './claude.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, '.claude', 'types');
const run = spawnSync(findClaude(), ['-p', '--no-session-persistence', `/plugin-types ${out}`], {
  cwd: root,
  encoding: 'utf8',
});
if (run.status !== 0 || !existsSync(path.join(out, 'claude-code.d.ts'))) {
  process.stderr.write(`Could not write the Claude Code types.\n${run.stdout}${run.stderr}`);
  process.exit(1);
}
process.stdout.write(`Claude Code types written to ${path.relative(root, out)}\n`);
