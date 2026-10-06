#!/usr/bin/env node
// Regenerates the lockfiles shipped in files/ (never edit them by hand).
//
//   node scripts/lockfiles.mjs
//
// files/package.json.tmpl is rendered for every css choice (dependencies are pinned there; the
// lockfile pins the transitive ones) and `npm install --package-lock-only` writes
// files/package-lock.json@css=<css>. Requires Node.js 24+ and npm.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = join(root, 'files');
const choices = { css: ['tailwind', 'none'] };

/**
 * Renders the subset of minijinja used by package.json.tmpl: `{% if %}`, `{% elif %}`, `{% else %}`,
 * `{% endif %}` with `choices.<name> == "<value>"` / `!=` conditions joined by `and` / `or`, and `-`
 * whitespace control. Anything else is an error, so a template change cannot be rendered wrongly.
 */
function render(template, selected) {
    const tag = /(\s*)\{%(-?)\s*(if|elif|else|endif)\b\s*(.*?)\s*(-?)%\}(\s*)/gs;
    const evaluate = (expression) =>
        expression.split(/\s+or\s+/).some((any) =>
            any.split(/\s+and\s+/).every((test) => {
                const match = /^choices\.(\w+)\s*(==|!=)\s*"([^"]*)"$/.exec(test.trim());
                if (!match) throw new Error(`unsupported condition: ${test}`);
                const [, name, op, value] = match;
                if (!(name in selected)) throw new Error(`unknown choice: ${name}`);
                return (selected[name] === value) === (op === '==');
            }),
        );
    const stack = []; // { active, taken, parentActive }
    const isActive = () => stack.every((frame) => frame.active);
    let out = '';
    let last = 0;
    for (const match of template.matchAll(tag)) {
        const [whole, before, trimBefore, keyword, expression, trimAfter, after] = match;
        if (isActive()) {
            out += template.slice(last, match.index) + (trimBefore ? '' : before);
        }
        if (keyword === 'if') {
            const active = evaluate(expression);
            stack.push({ active, taken: active });
        } else if (keyword === 'elif' || keyword === 'else') {
            const frame = stack.at(-1);
            if (!frame) throw new Error(`${keyword} without if`);
            const active = !frame.taken && (keyword === 'else' || evaluate(expression));
            frame.active = active;
            frame.taken ||= active;
        } else {
            if (!stack.pop()) throw new Error('endif without if');
        }
        if (isActive() && !trimAfter) out += after;
        last = match.index + whole.length;
    }
    if (stack.length) throw new Error('unclosed if');
    out += template.slice(last);
    if (/\{[{%#]/.test(out)) throw new Error('unsupported template syntax left after rendering');
    return out;
}

const template = readFileSync(join(files, 'package.json.tmpl'), 'utf8');
for (const css of choices.css) {
    const dir = mkdtempSync(join(tmpdir(), 'lockfile-'));
    try {
        const manifest = render(template, { css });
        JSON.parse(manifest); // must be valid JSON
        writeFileSync(join(dir, 'package.json'), manifest);
        copyFileSync(join(files, '.npmrc'), join(dir, '.npmrc'));
        execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
            cwd: dir,
            stdio: 'inherit',
        });
        const target = `package-lock.json@css=${css}`;
        copyFileSync(join(dir, 'package-lock.json'), join(files, target));
        console.log(`wrote files/${target}`);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
