import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/', '.claude/', 'node_modules/']),

  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  vue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // The settings page runs in a browser.
    files: ['ui/src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    // The settings server, the scripts and the tests run in Node.
    files: ['ui/server.ts', 'ui/lib/**/*.ts', 'ui/*.config.ts', 'scripts/**/*.ts', 'tests/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      eqeqeq: ['error', 'always'],
      'object-shorthand': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/multi-word-component-names': ['error', { ignores: ['Settings', 'Toasts'] }],
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-macros-order': 'error',
      'vue/no-unused-refs': 'error',
      'vue/no-useless-v-bind': 'error',
      'vue/padding-line-between-blocks': 'error',
    },
  },
  {
    // Tests index into data they just built and fake the engine with loose types.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // The hooks run in Claude Code's engine: no Node, no browser, only `$` (see AGENTS.md).
    files: ['hooks/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*', '../ui/*', '../../ui/*'], message: 'Hooks cannot use Node or the UI.' }] },
      ],
    },
  },
  {
    // Browser code goes through ui/src/api.ts for HTTP.
    files: ['ui/src/**/*.{ts,vue}'],
    ignores: ['ui/src/api.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Use the API client in ui/src/api.ts.' }],
    },
  },

  prettier,
);
