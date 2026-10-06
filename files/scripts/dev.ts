// `npm run dev`: the settings server (API on UI_PORT) and Vite (UI with hot
// reload on UI_DEV_PORT, proxying /api to the server), stopped together.

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { portOf, readDotenv } from '../ui/lib/env.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = readDotenv(root);
const apiPort = portOf(env.UI_PORT, 4777);
const devPort = portOf(env.UI_DEV_PORT, 5173);

const children: ChildProcess[] = [
  spawn(process.execPath, [path.join(root, 'ui', 'server.ts'), '--port', String(apiPort)], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn(
    path.join(root, 'node_modules', '.bin', 'vite'),
    ['--config', 'ui/vite.config.ts', '--port', String(devPort), '--strictPort'],
    { cwd: root, stdio: 'inherit' },
  ),
];

let stopping = false;
function stop(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1500).unref();
}

for (const child of children) child.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
