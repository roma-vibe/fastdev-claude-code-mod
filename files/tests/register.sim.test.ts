// The mod's real hooks against a fake engine (`$`): an in-memory file system and
// a scripted session. Covers the wiring the pure modules' tests cannot.

import { beforeEach, describe, expect, it } from 'vitest';

import { register } from '../hooks/register.ts';

type Handler = (...args: any[]) => any;
const handlers = new Map<string, Handler[]>();
const on = (event: string, ...rest: unknown[]): void => {
  const fn = rest[rest.length - 1] as Handler;
  handlers.set(event, [...(handlers.get(event) ?? []), fn]);
};
register(on as never, {} as never);

const HOME = '/home/r';
const NAME = 'my-mod';
const DATA = `${HOME}/.claude/mod-data/${NAME}`;
const CONFIG = `${DATA}/config.json`;
const SERVER = '/plugins/my-mod/ui/server.ts';

const files = new Map<string, { text: string; mtimeMs: number }>();
const env = new Map<string, string>([['HOME', HOME]]);
let clock = 1;
let statuses: (string | undefined)[] = [];
let logs: string[] = [];
let commands: { name: string; description: string; argumentHint?: string }[] = [];
let processes: string[][] = [];
/** Runs of the settings server: the first Node is "missing", the second answers. */
let nodeAnswers: ('missing' | 'fail' | string)[] = [];

const write = (path: string, text: string): void => void files.set(path, { text, mtimeMs: clock++ });

const $ = {
  plugin: { name: NAME, root: '/plugins/my-mod' },
  env: { get: async (name: string) => env.get(name) },
  fs: {
    read: async (path: string) => {
      const file = files.get(path);
      if (!file) throw new Error('ENOENT');
      return file.text;
    },
    write: async (path: string, text: string) => write(path, text),
    stat: async (path: string) => {
      const file = files.get(path);
      if (!file) throw new Error('ENOENT');
      return { kind: 'file', size: file.text.length, mtimeMs: file.mtimeMs, isLink: false };
    },
    exists: async (path: string) => files.has(path) || path === SERVER,
  },
  ui: {
    status: (text?: string) => void statuses.push(text),
    log: (text: string) => void logs.push(text),
  },
  command: {
    register: async (spec: (typeof commands)[number]) => void commands.push(spec),
  },
  process: {
    run: async (argv: string[]) => {
      processes.push(argv);
      const answer = nodeAnswers.shift() ?? 'missing';
      if (answer === 'missing') throw new Error('spawn ENOENT');
      if (answer === 'fail') return { exitCode: 1, stdout: '', stderr: 'port in use' };
      return { exitCode: 0, stdout: `${answer}\n`, stderr: '' };
    },
  },
};

const call = (event: string, input: Record<string, unknown>, next: Handler = async (e) => e) => {
  const chain = handlers.get(event) ?? [];
  const run = (i: number, e: Record<string, unknown>): unknown =>
    chain[i] ? chain[i]($, e, (x: Record<string, unknown>) => run(i + 1, x)) : next(e);
  return run(0, input);
};
const command = async (args: string): Promise<string> =>
  ((await call('command.run', { command: NAME, args })) as { text: string }).text;
const lastStatus = (): string | undefined => statuses[statuses.length - 1];

beforeEach(() => {
  files.clear();
  statuses = [];
  logs = [];
  commands = [];
  processes = [];
  nodeAnswers = [];
});

describe('session.start', () => {
  it('writes the default settings, registers /<name> and shows the greeting', async () => {
    await call('session.start', {});
    expect(JSON.parse(files.get(CONFIG)!.text)).toMatchObject({
      enabled: true,
      language: 'en',
      greeting: 'Hello from fastDev',
    });
    expect(commands.map((c) => c.name)).toEqual([NAME]);
    expect(lastStatus()).toBe('Hello from fastDev');
    expect(logs).toEqual([]);
  });

  it('shows nothing while the mod is off, and speaks the settings language', async () => {
    write(CONFIG, JSON.stringify({ enabled: false, language: 'ru' }));
    await call('session.start', {});
    expect(lastStatus()).toBeUndefined();
    expect(commands[0]!.description).toMatch(/приветствие/);
  });
});

describe('turn.start', () => {
  it('picks up a change made in the settings UI', async () => {
    await call('session.start', {});
    write(CONFIG, JSON.stringify({ greeting: 'Changed' }));
    await call('turn.start', {});
    expect(lastStatus()).toBe('Changed');
    write(CONFIG, JSON.stringify({ enabled: false }));
    await call('turn.start', {});
    expect(lastStatus()).toBeUndefined();
  });

  it('works when nothing started the mod before (a reload)', async () => {
    write(CONFIG, JSON.stringify({ greeting: 'After reload' }));
    await call('turn.start', {});
    expect(lastStatus()).toBe('After reload');
  });
});

describe('command', () => {
  it('ignores other commands', async () => {
    const result = await call('command.run', { command: 'other', args: '' }, async () => 'passed on');
    expect(result).toBe('passed on');
  });

  it('shows the status', async () => {
    await call('session.start', {});
    expect(await command('')).toBe('Hello from fastDev\nmy-mod is on · language: en · settings: /my-mod ui');
    expect(await command('nonsense')).toBe('Usage: /my-mod [status|on|off|ui|reload]');
  });

  it('turns the mod off and on, and saves the choice', async () => {
    await call('session.start', {});
    expect(await command('off')).toBe('my-mod is off.');
    expect(lastStatus()).toBeUndefined();
    expect(JSON.parse(files.get(CONFIG)!.text).enabled).toBe(false);
    expect(await command('')).toBe('my-mod is off. Turn it on with /my-mod on or in the settings: /my-mod ui');
    expect(await command('ON')).toBe('my-mod is on.');
    expect(lastStatus()).toBe('Hello from fastDev');
  });

  it('reloads the settings file', async () => {
    await call('session.start', {});
    write(CONFIG, JSON.stringify({ greeting: 'Edited by hand', language: 'ru' }));
    expect(await command('reload')).toBe('Настройки перечитаны.');
    expect(lastStatus()).toBe('Edited by hand');
    expect(await command('')).toMatch(/включён/);
  });

  it('starts the settings UI with the first Node that works', async () => {
    await call('session.start', {});
    nodeAnswers = ['missing', 'fail', 'App: http://127.0.0.1:4777'];
    expect(await command('ui')).toBe('App: http://127.0.0.1:4777');
    expect(processes.map((argv) => argv[0])).toEqual(['node', '/opt/homebrew/bin/node', '/usr/local/bin/node']);
    expect(processes[2]!.slice(1)).toEqual(['/plugins/my-mod/ui/server.ts', '--detach', '--data', DATA]);
  });

  it('says how to start the UI by hand when no Node works, or the server is missing', async () => {
    await call('session.start', {});
    expect(await command('ui')).toBe(
      'Could not start the settings UI. Start it yourself: node "/plugins/my-mod/ui/server.ts"',
    );
    const exists = $.fs.exists;
    $.fs.exists = async () => false;
    try {
      expect(await command('ui')).toBe('The settings server was not found at /plugins/my-mod/ui/server.ts.');
    } finally {
      $.fs.exists = exists;
    }
  });
});
