// The settings server's request handler: a small JSON API over the mod's
// settings file, plus the built UI (ui/dist). No dependencies; Node runs this
// TypeScript directly. Validation is the hooks' own code (hooks/lib/config.ts).

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import {
  DEFAULT_CONFIG,
  GREETING_MAX,
  parsePatch,
  resolveConfig,
  type ModConfig,
  type PatchIssue,
} from '../../hooks/lib/config.ts';
import { configFile } from '../../hooks/lib/paths.ts';
import { parseLanguage, tr, withLanguage } from './i18n.ts';

export type HandlerOptions = {
  /** The plugin's name (plugin.json). */
  name: string;
  /** The name shown to people (`APP_NAME`). */
  title: string;
  version: string;
  /** The data folder; the settings file is `config.json` in it. */
  data: string;
  /** The built UI. */
  dist: string;
};

const BODY_LIMIT = 256 * 1024;
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Writes `text` next to `file` and renames it over: readers never see a half-written file. */
export async function writeAtomic(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`,
  );
  try {
    await fs.writeFile(tmp, text);
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

export async function readConfig(data: string): Promise<ModConfig> {
  try {
    return resolveConfig(JSON.parse(await fs.readFile(configFile(data), 'utf8')) as unknown);
  } catch {
    return DEFAULT_CONFIG;
  }
}

const writeConfig = async (data: string, config: ModConfig): Promise<ModConfig> => {
  await writeAtomic(configFile(data), `${JSON.stringify(config, null, 2)}\n`);
  return config;
};

/** One mutation at a time. */
let lockChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.catch(() => undefined);
  return run;
}

async function readBody(req: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > BODY_LIMIT)
      throw new HttpError(413, tr('The request body is larger than 256 KB.', 'Тело запроса больше 256 КБ.'));
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(body)) throw new Error('not an object');
    return body;
  } catch {
    throw new HttpError(400, tr('The request body must be a JSON object.', 'Тело запроса должно быть JSON-объектом.'));
  }
}

function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

/** Only this machine, and mutations only from this server's own page (Host, a custom header, Origin). */
function guard(req: IncomingMessage): void {
  const hostHeader = String(req.headers.host ?? '').toLowerCase();
  if (!ALLOWED_HOSTS.has(hostHeader.replace(/:\d+$/, '')))
    throw new HttpError(403, tr('Invalid Host header.', 'Недопустимый заголовок Host.'));
  if (req.method === 'GET' || req.method === 'HEAD') return;
  if (req.headers['x-mod-request'] !== '1')
    throw new HttpError(403, tr('The X-Mod-Request: 1 header is required.', 'Нужен заголовок X-Mod-Request: 1.'));
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${hostHeader}`)
    throw new HttpError(403, tr('Invalid Origin.', 'Недопустимый Origin.'));
}

/** What was wrong with a settings change, in the language of the request. */
function describeIssue(issue: PatchIssue): string {
  switch (issue.reason) {
    case 'type':
      return tr(`“${issue.field}” has the wrong type.`, `У поля «${issue.field}» неверный тип.`);
    case 'empty':
      return tr(`“${issue.field}” must not be empty.`, `Поле «${issue.field}» не должно быть пустым.`);
    case 'too-long':
      return tr(
        `“${issue.field}” is longer than ${GREETING_MAX} characters.`,
        `Поле «${issue.field}» длиннее ${GREETING_MAX} символов.`,
      );
    case 'unsupported':
      return tr(`“${issue.field}” has an unsupported value.`, `У поля «${issue.field}» недопустимое значение.`);
    case 'unknown-field':
      return tr(`Unknown setting “${issue.field}”.`, `Неизвестная настройка «${issue.field}».`);
  }
}

async function api(
  options: HandlerOptions,
  req: IncomingMessage,
  res: ServerResponse,
  segments: string[],
): Promise<void> {
  const method = req.method ?? 'GET';
  const [, resource, action] = segments;
  const notFound = (): never => {
    throw new HttpError(404, tr('Not found.', 'Не найдено.'));
  };

  if (resource === 'health' && method === 'GET' && !action) {
    return send(res, 200, {
      ok: true,
      name: options.name,
      title: options.title,
      version: options.version,
      data: options.data,
    });
  }
  if (resource === 'config') {
    if (!action && method === 'GET') return send(res, 200, await readConfig(options.data));
    if (!action && method === 'PUT') {
      const { patch, issues } = parsePatch(await readBody(req));
      if (issues.length > 0) throw new HttpError(400, issues.map(describeIssue).join(' '));
      return send(
        res,
        200,
        await withLock(async () => writeConfig(options.data, { ...(await readConfig(options.data)), ...patch })),
      );
    }
    if (action === 'reset' && method === 'POST')
      return send(res, 200, await withLock(() => writeConfig(options.data, DEFAULT_CONFIG)));
  }
  return notFound();
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const PAGE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

const missingDist = (
  title: string,
): string => `<!doctype html><html lang="${tr('en', 'ru')}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/[<&>]/g, '')}</title>
<style>body{font:16px system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1rem;line-height:1.5;color:#18181b}
code{background:#f4f4f5;padding:.15em .4em;border-radius:4px}@media(prefers-color-scheme:dark){body{background:#09090b;color:#f4f4f5}code{background:#27272a}}</style>
<p>${tr('The interface has not been built yet. Run in the project folder:', 'Интерфейс ещё не собран. Выполните в папке проекта:')}</p>
<p><code>npm run build</code></p>
<p>${tr('Then reload the page. The API is already running:', 'Затем обновите страницу. API уже работает:')} <code>/api/health</code>.</p></html>`;

async function serveStatic(
  options: HandlerOptions,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    throw new HttpError(405, tr('Method not supported.', 'Метод не поддерживается.'));
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, tr('Invalid path.', 'Неверный путь.'));
  }
  const dist = options.dist;
  const wanted = path.normalize(path.join(dist, decoded));
  let file = wanted.startsWith(dist + path.sep) ? wanted : path.join(dist, 'index.html');
  let content: Buffer;
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    content = await fs.readFile(file);
  } catch {
    // Single-page fallback, only for paths that are not files.
    if (path.extname(decoded)) throw new HttpError(404, tr('Not found.', 'Не найдено.'));
    file = path.join(dist, 'index.html');
    try {
      content = await fs.readFile(file);
    } catch {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...PAGE_HEADERS });
      return void res.end(req.method === 'HEAD' ? undefined : missingDist(options.title));
    }
  }
  const immutable = file.startsWith(path.join(dist, 'assets') + path.sep);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...PAGE_HEADERS,
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}

async function handleRequest(options: HandlerOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    guard(req);
    const rawPath = (req.url ?? '/').split('?')[0] ?? '/';
    if (rawPath === '/api' || rawPath.startsWith('/api/')) {
      const segments = rawPath
        .split('/')
        .filter(Boolean)
        .map((segment) => {
          try {
            return decodeURIComponent(segment);
          } catch {
            throw new HttpError(400, tr('Invalid path.', 'Неверный путь.'));
          }
        });
      await api(options, req, res, segments);
    } else {
      await serveStatic(options, req, res, new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
    }
  } catch (error) {
    if (res.headersSent) return void res.end();
    if (error instanceof HttpError) return send(res, error.status, { error: error.message });
    process.stderr.write(
      `${options.name} UI: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    send(res, 500, { error: tr('Internal server error.', 'Внутренняя ошибка сервера.') });
  }
}

export function createHandler(options: HandlerOptions): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void withLanguage(parseLanguage(req.headers['x-mod-lang']), () => handleRequest(options, req, res));
  };
}
