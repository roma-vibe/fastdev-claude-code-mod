// Reads the project's `.env` the exact way (no `$VAR` expansion), for the
// settings server, the Vite config and the dev script. The hooks never read it:
// they have no Node, and everything they need comes from the settings file.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export function readDotenv(root: string): Record<string, string> {
  try {
    const parsed = parseEnv(readFileSync(path.join(root, '.env'), 'utf8'));
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
    );
  } catch {
    return {};
  }
}

/** A TCP port from text, or `fallback` when it is missing or not a port. */
export function portOf(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : fallback;
}
