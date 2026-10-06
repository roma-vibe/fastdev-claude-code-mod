// The settings server's API against a real HTTP server on a free port.

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHandler } from '../ui/lib/handler.ts';

let dir: string;
let server: http.Server;
let base: string;

const MUTATE = { 'X-Mod-Request': '1', 'Content-Type': 'application/json' };
const put = (body: unknown, headers: Record<string, string> = MUTATE) =>
  fetch(`${base}/api/config`, { method: 'PUT', headers, body: JSON.stringify(body) });

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mod-ui-'));
  await mkdir(path.join(dir, 'dist', 'assets'), { recursive: true });
  await writeFile(path.join(dir, 'dist', 'index.html'), '<!doctype html><title>ui</title>');
  await writeFile(path.join(dir, 'dist', 'assets', 'app.js'), 'export {}');
  server = http.createServer(
    createHandler({
      name: 'my-mod',
      title: 'My Mod',
      version: '1.2.3',
      data: path.join(dir, 'data'),
      dist: path.join(dir, 'dist'),
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

describe('API', () => {
  it('answers health', async () => {
    const body = await (await fetch(`${base}/api/health`)).json();
    expect(body).toEqual({ ok: true, name: 'my-mod', title: 'My Mod', version: '1.2.3', data: path.join(dir, 'data') });
  });

  it('serves the defaults, then saves a change atomically to config.json', async () => {
    expect(await (await fetch(`${base}/api/config`)).json()).toMatchObject({
      enabled: true,
      language: 'en',
      greeting: 'Hello from fastDev',
    });
    const saved = await put({ greeting: ' Hi there ', language: 'ru' });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ greeting: 'Hi there', language: 'ru', enabled: true });
    expect(JSON.parse(await readFile(path.join(dir, 'data', 'config.json'), 'utf8'))).toMatchObject({
      greeting: 'Hi there',
    });
    expect(await (await fetch(`${base}/api/config`)).json()).toMatchObject({ greeting: 'Hi there' });
  });

  it('rejects invalid changes with a message in the requested language', async () => {
    const english = await put({ greeting: '', color: 'red' });
    expect(english.status).toBe(400);
    expect(await english.json()).toEqual({ error: '“greeting” must not be empty. Unknown setting “color”.' });
    const russian = await put({ language: 'de' }, { ...MUTATE, 'X-Mod-Lang': 'ru' });
    expect(await russian.json()).toEqual({ error: 'У поля «language» недопустимое значение.' });
    expect((await fetch(`${base}/api/config`, { method: 'PUT', headers: MUTATE, body: '[1]' })).status).toBe(400);
    expect(
      (await fetch(`${base}/api/config`, { method: 'PUT', headers: MUTATE, body: 'x'.repeat(300_000) })).status,
    ).toBe(413);
  });

  it('resets to the defaults', async () => {
    const reset = await fetch(`${base}/api/config/reset`, { method: 'POST', headers: MUTATE, body: '{}' });
    expect(await reset.json()).toMatchObject({ greeting: 'Hello from fastDev', language: 'en' });
  });

  it('answers 404 for unknown API paths', async () => {
    expect((await fetch(`${base}/api/nothing`)).status).toBe(404);
    expect((await fetch(`${base}/api/config/x`)).status).toBe(404);
  });
});

describe('guard', () => {
  it('refuses a change without the custom header or from another origin', async () => {
    expect((await put({ enabled: false }, { 'Content-Type': 'application/json' })).status).toBe(403);
    expect((await put({ enabled: false }, { ...MUTATE, Origin: 'http://evil.example' })).status).toBe(403);
    expect((await put({ enabled: true }, { ...MUTATE, Origin: base })).status).toBe(200);
  });

  it('refuses a foreign Host header', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const url = new URL(`${base}/api/health`);
      http
        .get({ host: url.hostname, port: url.port, path: url.pathname, headers: { host: 'evil.example' } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        })
        .on('error', reject);
    });
    expect(status).toBe(403);
  });
});

describe('static files', () => {
  it('serves the built page, with assets cached and unknown routes falling back to it', async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain('<title>ui</title>');
    expect(await (await fetch(`${base}/settings`)).text()).toContain('<title>ui</title>');
    const asset = await fetch(`${base}/assets/app.js`);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
  });

  it('does not leave the dist folder', async () => {
    const response = await fetch(`${base}/..%2F..%2Fdata%2Fconfig.json`);
    expect(await response.text()).toContain('<title>ui</title>');
  });

  it('explains how to build when there is no build', async () => {
    await rm(path.join(dir, 'dist', 'index.html'));
    const page = await (await fetch(`${base}/`)).text();
    expect(page).toContain('npm run build');
    expect(page).toContain('My Mod');
  });
});
