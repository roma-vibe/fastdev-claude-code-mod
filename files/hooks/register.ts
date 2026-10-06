// The mod's entry point: Claude Code loads this module and calls `register`.
// This skeleton puts one line of text into Claude Code (the status line) and
// has one slash command, `/<plugin name>`. The text and the language come
// from the settings file the settings UI edits (docs: AGENTS.md, "Data").
//
// Keep this file thin: wire events to the pure, unit-tested code in ./lib.
// A hooks module runs in an environment of its own, with no Node and no DOM;
// everything outside it goes through `$` (the engine interface).

import type { EngineInterface, Register } from 'claude-code';

import { DEFAULT_CONFIG, resolveConfig, type ModConfig } from './lib/config.ts';
import { message } from './lib/messages.ts';
import { configFile, dataDir, nodeCandidates } from './lib/paths.ts';

/**
 * What the module remembers between hooks. A reload of the module starts it
 * over (`session.start` fires again and rebinds); what is on disk stays.
 */
const S: { home: string; data: string; cfg: ModConfig; cfgMtime: number } = {
  home: '',
  data: '',
  cfg: DEFAULT_CONFIG,
  cfgMtime: -1,
};

/** The slash command is the plugin's name; rename it here if it is too long to type. */
const commandName = ($: EngineInterface): string => $.plugin.name;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Finds the mod's data folder. */
async function bind($: EngineInterface): Promise<void> {
  S.home = (await $.env.get('HOME')) ?? '';
  S.data = dataDir({ name: $.plugin.name, home: S.home });
}

/** Reads the settings file again when it changed (or `force`); writes the defaults on first run. */
async function loadConfig($: EngineInterface, force: boolean): Promise<void> {
  const path = configFile(S.data);
  try {
    const stat = await $.fs.stat(path);
    if (!force && stat.mtimeMs === S.cfgMtime) return;
    S.cfg = resolveConfig(JSON.parse(String(await $.fs.read(path))));
    S.cfgMtime = stat.mtimeMs;
  } catch {
    // Missing or unreadable: the defaults, written out so the settings UI has a file to edit.
    S.cfg = DEFAULT_CONFIG;
    try {
      await saveConfig($);
    } catch (error) {
      S.cfgMtime = -1;
      $.ui.log(`${$.plugin.name}: could not write the settings (${errorText(error)})`);
    }
  }
}

async function saveConfig($: EngineInterface): Promise<void> {
  const path = configFile(S.data);
  await $.fs.write(path, `${JSON.stringify(S.cfg, null, 2)}\n`);
  S.cfgMtime = (await $.fs.stat(path)).mtimeMs;
}

/** The whole feature: the greeting in Claude Code's status line while the mod is on. */
function showGreeting($: EngineInterface): void {
  $.ui.status(S.cfg.enabled ? S.cfg.greeting : undefined);
}

async function startUi($: EngineInterface): Promise<string> {
  const server = `${$.plugin.root}/ui/server.ts`;
  const language = S.cfg.language;
  if (!(await $.fs.exists(server))) return message(language, 'uiMissing', { path: server });
  for (const node of nodeCandidates(S.home)) {
    try {
      const run = await $.process.run([node, server, '--detach', '--data', S.data], { timeoutMs: 15_000 });
      if (run.exitCode === 0) return run.stdout.trim();
    } catch {
      // not found or did not start: try the next place
    }
  }
  return message(language, 'uiFailed', { path: server });
}

async function runCommand($: EngineInterface, args: string): Promise<string> {
  const name = $.plugin.name;
  const language = S.cfg.language;
  const arg = args.trim().toLowerCase();
  if (arg === '' || arg === 'status') {
    return S.cfg.enabled
      ? message(language, 'statusOn', { greeting: S.cfg.greeting, name, language })
      : message(language, 'statusOff', { name });
  }
  if (arg === 'on' || arg === 'off') {
    await loadConfig($, true);
    S.cfg = { ...S.cfg, enabled: arg === 'on' };
    await saveConfig($);
    showGreeting($);
    return message(S.cfg.language, arg === 'on' ? 'enabled' : 'disabled', { name });
  }
  if (arg === 'reload') {
    await loadConfig($, true);
    showGreeting($);
    return message(S.cfg.language, 'reloaded');
  }
  if (arg === 'ui') return startUi($);
  return message(language, 'usage', { name });
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const result = await next(e);
    try {
      await bind($);
      await loadConfig($, true);
      await $.command.register({
        name: commandName($),
        description: message(S.cfg.language, 'commandDescription'),
        argumentHint: message(S.cfg.language, 'commandHint'),
      });
      showGreeting($);
    } catch (error) {
      $.ui.log(`${$.plugin.name}: start failed (${errorText(error)})`);
    }
    return result;
  });

  on('command.run', async ($, e, next) => {
    if (e.command !== commandName($)) return next(e);
    if (S.data === '') await bind($);
    await loadConfig($, false);
    return { text: await runCommand($, e.args) };
  });

  // A change made in the settings UI shows up at the next turn.
  on('turn.start', async ($, e, next) => {
    if (S.data === '') await bind($);
    await loadConfig($, false);
    showGreeting($);
    return next(e);
  });
};
