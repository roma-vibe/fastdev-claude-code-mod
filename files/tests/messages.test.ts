import { describe, expect, it } from 'vitest';

import { MESSAGES, message } from '../hooks/lib/messages.ts';

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('messages', () => {
  it('has a Russian text for every English one, with the same placeholders', () => {
    expect(Object.keys(MESSAGES.ru).sort()).toEqual(Object.keys(MESSAGES.en).sort());
    for (const key of Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]) {
      expect(placeholders(MESSAGES.ru[key]), key).toEqual(placeholders(MESSAGES.en[key]));
    }
  });

  it('has no Cyrillic in the English texts', () => {
    expect(Object.values(MESSAGES.en).filter((text) => /[А-Яа-яЁё]/.test(text))).toEqual([]);
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(message('en', 'enabled', { name: 'my-mod' })).toBe('my-mod is on.');
    expect(message('ru', 'disabled', { name: 'my-mod' })).toBe('my-mod выключен.');
    expect(message('en', 'enabled')).toBe('{name} is on.');
  });
});
