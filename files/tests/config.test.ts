import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, GREETING_MAX, parsePatch, resolveConfig, singleLine } from '../hooks/lib/config.ts';

describe('resolveConfig', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const raw of [undefined, null, 'x', 3, []]) expect(resolveConfig(raw)).toEqual(DEFAULT_CONFIG);
  });

  it('keeps valid values and falls back field by field', () => {
    expect(resolveConfig({ enabled: false, language: 'ru', greeting: 'Hi' })).toEqual({
      version: 1,
      enabled: false,
      language: 'ru',
      greeting: 'Hi',
    });
    expect(resolveConfig({ enabled: 'no', language: 'de', greeting: '   ' })).toEqual(DEFAULT_CONFIG);
  });

  it('puts the greeting on one line and cuts it', () => {
    expect(resolveConfig({ greeting: ' a\n\tb  c ' }).greeting).toBe('a b c');
    expect(resolveConfig({ greeting: 'x'.repeat(GREETING_MAX + 20) }).greeting).toHaveLength(GREETING_MAX);
  });

  it('ignores unknown keys', () => {
    expect(resolveConfig({ other: 1 })).toEqual(DEFAULT_CONFIG);
  });
});

describe('parsePatch', () => {
  it('accepts valid changes', () => {
    expect(parsePatch({ enabled: false, language: 'ru', greeting: '  Hello  ' })).toEqual({
      patch: { enabled: false, language: 'ru', greeting: 'Hello' },
      issues: [],
    });
  });

  it('reports every problem instead of dropping it', () => {
    const { patch, issues } = parsePatch({
      enabled: 'yes',
      language: 'de',
      greeting: '',
      version: 2,
    });
    expect(patch).toEqual({});
    expect(issues).toEqual([
      { field: 'enabled', reason: 'type' },
      { field: 'language', reason: 'unsupported' },
      { field: 'greeting', reason: 'empty' },
      { field: 'version', reason: 'unknown-field' },
    ]);
    expect(parsePatch({ greeting: 'x'.repeat(GREETING_MAX + 1) }).issues).toEqual([
      { field: 'greeting', reason: 'too-long' },
    ]);
    expect(parsePatch({ language: 3 }).issues).toEqual([{ field: 'language', reason: 'type' }]);
  });
});

describe('singleLine', () => {
  it('removes control characters and extra spaces', () => {
    expect(singleLine('a\u0000b\r\n c\u007f')).toBe('a b c');
  });
});
