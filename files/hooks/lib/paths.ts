// Where the mod keeps its data. The hooks (inside Claude Code) and the settings
// UI server (Node) must agree, so both ask this module. Pure string code: it
// runs where there is no Node `path`.

/** Under the home folder, in a folder of its own: a mod never mixes with Claude Code's files. */
const DATA_ROOT = '.claude/mod-data';

/** The data folder of the mod `name`: `~/.claude/mod-data/<name>`. */
export function dataDir(options: { name: string; home: string }): string {
  return `${options.home}/${DATA_ROOT}/${options.name}`;
}

export const configFile = (dir: string): string => `${dir}/config.json`;

/** Where to look for Node when Claude Code (started from an app) has no shell PATH. The UI server needs Node 24+. */
export function nodeCandidates(home: string): string[] {
  return [
    'node',
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    `${home}/.local/bin/node`,
    `${home}/.volta/bin/node`,
  ];
}
