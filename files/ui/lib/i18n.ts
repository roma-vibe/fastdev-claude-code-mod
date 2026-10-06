import { AsyncLocalStorage } from 'node:async_hooks';

import type { Language } from '../../hooks/lib/config.ts';

const requestLanguage = new AsyncLocalStorage<Language>();

/** Language of messages outside a request (command line, startup): the configured one. */
let fallback: Language = 'en';

export const setFallbackLanguage = (language: Language): void => {
  fallback = language;
};

export const parseLanguage = (value: unknown): Language | undefined =>
  value === 'ru' || value === 'en' ? value : undefined;

/** Runs `fn` with the language the page asked for (header `X-Mod-Lang`). */
export const withLanguage = <T>(language: Language | undefined, fn: () => T): T =>
  language ? requestLanguage.run(language, fn) : fn();

/** The text in the language of the current request: `tr('Not found.', 'Не найдено.')`. */
export const tr = (en: string, ru: string): string => ((requestLanguage.getStore() ?? fallback) === 'ru' ? ru : en);
