# Claude Code Mod

A starting point for a **mod for Claude Code**: a plugin of function hooks in TypeScript that hot-reloads in the running session. It does one tiny thing, puts “Hello from fastDev” in the status line, and brings everything a real mod needs around it, so the next mod starts from working structure instead of a blank folder.

This repository is a [fastDev](https://github.com/roma-vibe/fastDev) project skeleton (`claude-code-mod`). fastDev lists it from a registry, downloads it when first used and creates named, ready-to-run projects from it. Versions are the `vX.Y.Z` tags of this repository and never change once published.

## When to choose it

A new mod for Claude Code: something that shows or changes things in a session (status line, panes, toasts, hooks on turns and tool calls, slash commands) and may need a settings page. The example behaviour is meant to be replaced; the structure is meant to be kept.

## What is inside

| Part | Choice |
| --- | --- |
| Hooks | `hooks/register.ts` (thin wiring) + pure, tested code in `hooks/lib/` (settings, messages, paths) |
| Command | `/<name>`: `status`, `on`, `off`, `reload`, `ui` |
| Settings | One JSON file in `~/.claude/mod-data/<name>/`, shared by the hooks and the page; main switch, language (English/Russian), greeting |
| Settings page | Vue 3, Vite 8; English and Russian, light and dark. Styles are a choice at creation: Tailwind CSS 4 (default) or plain CSS with variables; the components use the same class names with both |
| Settings server | Plain Node 24+, no dependencies, local only (Host/Origin checks, custom header on changes) |
| Tests | Vitest 5: pure modules, the HTTP handler on a real port, the hooks against a fake engine, translations |
| Quality | ESLint 10, Prettier, strict `tsc` and `vue-tsc`, and `claude plugin validate` in `npm run check` |

## Using a new mod

`npm run types` (setup does it) writes Claude Code's declarations for the version you run. Load the project with `claude --plugin-dir <folder>`, or list it in `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`; the generated `README.md` and `AGENTS.md` explain both.

## Files

- `scripts/lockfiles.mjs`: regenerates the lockfiles in `files/` (one per styles choice) from `files/package.json.tmpl`; run it after changing a dependency.
- `template.toml`: the manifest (ports, the `css` choice, `[[set]]` edits that give the plugin its name, setup, commands, translations).
- `files/`: the files of a new project (`*.tmpl` files are rendered with the project name and ports).
- `CHANGELOG.md`: what changed in every version.
