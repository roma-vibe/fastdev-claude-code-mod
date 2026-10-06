// Finds the Claude Code executable. A GUI-started shell often has no `claude`
// on PATH, so the desktop app's bundled copy is the fallback. `CLAUDE_BIN`
// overrides both.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const works = (bin: string): boolean => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0;

/** Version folders sorted numerically (`2.1.9` before `2.1.10`), newest last. */
const byVersion = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });

function bundled(): string | undefined {
  const root = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude-code');
  try {
    for (const version of readdirSync(root).sort(byVersion).reverse()) {
      for (const build of readdirSync(path.join(root, version))) {
        const bin = path.join(root, version, build, 'claude.app', 'Contents', 'MacOS', 'claude');
        if (existsSync(bin)) return bin;
      }
    }
  } catch {
    // no desktop app here
  }
  return undefined;
}

export function findClaude(): string {
  const candidates = [process.env.CLAUDE_BIN, 'claude', bundled()];
  for (const bin of candidates) if (bin && works(bin)) return bin;
  process.stderr.write('Claude Code was not found. Install it, or set CLAUDE_BIN to its executable.\n');
  process.exit(1);
}
