#!/usr/bin/env node
// The settings UI server: a dependency-free local server.
//
//   node ui/server.ts [--port <n>] [--data <dir>] [--detach]
//
// It serves the built Vue app (ui/dist) and the JSON API over the mod's data
// folder. The port is `--port`, else `UI_PORT` in .env, else 4777. The data
// folder is `--data`, else the default of hooks/lib/paths.ts. Node runs TypeScript directly: no enums, namespaces
// or parameter properties, and type-only imports marked `import type`.

import { spawn } from 'node:child_process';
import { promises as fs, readFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { dataDir } from '../hooks/lib/paths.ts';
import { readDotenv, portOf } from './lib/env.ts';
import { createHandler, readConfig, writeAtomic } from './lib/handler.ts';
import { setFallbackLanguage, tr } from './lib/i18n.ts';

const UI_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(UI_DIR);
const plugin = JSON.parse(readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')) as {
  name: string;
  version: string;
};
const env = readDotenv(ROOT);
const TITLE = env.APP_NAME || plugin.name;

function fail(message: string): never {
  process.stderr.write(`${TITLE} UI: ${message}\n`);
  process.exit(1);
}

type Args = { detach: boolean; port: string | undefined; data: string | undefined; help: boolean };

function parseArgs(argv: readonly string[]): Args {
  const out: Args = { detach: false, port: undefined, data: undefined, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const inline = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : undefined;
    const name = inline === undefined ? arg : arg.slice(0, arg.indexOf('='));
    if (name === '--detach') out.detach = true;
    else if (name === '--port') out.port = inline ?? argv[++i];
    else if (name === '--data') out.data = inline ?? argv[++i];
    else if (name === '--help' || name === '-h') out.help = true;
    else fail(tr(`Unknown argument: ${arg}`, `Неизвестный аргумент: ${arg}`));
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write('node ui/server.ts [--port <n>] [--data <dir>] [--detach]\n');
  process.exit(0);
}

const HOME = os.homedir();
const DATA = path.resolve(args.data ?? dataDir({ name: plugin.name, home: HOME }));
const PORT = portOf(args.port ?? env.UI_PORT, 4777);
if (args.port !== undefined && portOf(args.port, 0) === 0)
  fail(tr(`Invalid port: ${args.port}`, `Недопустимый порт: ${args.port}`));
setFallbackLanguage((await readConfig(DATA)).language);
const URL_LINE = `${TITLE}: http://127.0.0.1:${PORT}`;

async function healthy(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    const body: unknown = response.ok ? await response.json() : undefined;
    return typeof body === 'object' && body !== null && 'ok' in body && body.ok === true;
  } catch {
    return false;
  }
}

/** Starts the server in the background (once), then prints the address. `<data>/ui.pid` holds its pid. */
async function detach(): Promise<void> {
  if (await healthy(PORT)) return void process.stdout.write(`${URL_LINE}\n`);
  await fs.mkdir(DATA, { recursive: true });
  const child = spawn(
    process.execPath,
    [...process.execArgv, fileURLToPath(import.meta.url), '--port', String(PORT), '--data', DATA],
    {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    },
  );
  let exited = false;
  child.on('exit', () => (exited = true));
  child.on('error', () => (exited = true));
  child.unref();
  if (child.pid === undefined) fail(tr('could not start the server.', 'не удалось запустить сервер.'));
  await writeAtomic(path.join(DATA, 'ui.pid'), `${child.pid}\n`);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !exited) {
    if (await healthy(PORT)) return void process.stdout.write(`${URL_LINE}\n`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (exited) await fs.rm(path.join(DATA, 'ui.pid'), { force: true });
  fail(
    tr(
      `the server did not respond on port ${PORT} (busy with another process?). Start it manually: node ${fileURLToPath(import.meta.url)} --port ${PORT}`,
      `сервер не ответил на порту ${PORT} (занят другим процессом?). Запустите вручную: node ${fileURLToPath(import.meta.url)} --port ${PORT}`,
    ),
  );
}

function serve(): void {
  const server = http.createServer(
    createHandler({
      name: plugin.name,
      title: TITLE,
      version: plugin.version,
      data: DATA,
      dist: path.join(UI_DIR, 'dist'),
    }),
  );
  server.on('error', (error: NodeJS.ErrnoException) => {
    fail(error.code === 'EADDRINUSE' ? tr(`port ${PORT} is in use.`, `порт ${PORT} занят.`) : error.message);
  });
  server.listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`${URL_LINE}\ndata: ${DATA}\n`);
  });
  const stop = (): void => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (args.detach) await detach();
else serve();
