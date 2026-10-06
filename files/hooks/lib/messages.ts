// The mod's own messages (what its command answers), in the language of the
// settings. English is the source text; every key needs a Russian text, and
// tests/messages.test.ts keeps both tables in step. `{name}` placeholders are
// filled by `message`. Pure code.

import type { Language } from './config.ts';

const EN = {
  commandDescription: 'Show the mod greeting; on, off, ui, reload',
  commandHint: '[status|on|off|ui|reload]',
  statusOn: '{greeting}\n{name} is on · language: {language} · settings: /{name} ui',
  statusOff: '{name} is off. Turn it on with /{name} on or in the settings: /{name} ui',
  enabled: '{name} is on.',
  disabled: '{name} is off.',
  reloaded: 'Settings reloaded.',
  usage: 'Usage: /{name} [status|on|off|ui|reload]',
  uiMissing: 'The settings server was not found at {path}.',
  uiFailed: 'Could not start the settings UI. Start it yourself: node "{path}"',
} as const;

export type MessageKey = keyof typeof EN;

const RU: Record<MessageKey, string> = {
  commandDescription: 'Показать приветствие мода; on, off, ui, reload',
  commandHint: '[status|on|off|ui|reload]',
  statusOn: '{greeting}\n{name} включён · язык: {language} · настройки: /{name} ui',
  statusOff: '{name} выключен. Включите: /{name} on или в настройках: /{name} ui',
  enabled: '{name} включён.',
  disabled: '{name} выключен.',
  reloaded: 'Настройки перечитаны.',
  usage: 'Использование: /{name} [status|on|off|ui|reload]',
  uiMissing: 'Сервер настроек не найден: {path}.',
  uiFailed: 'Не удалось запустить интерфейс настроек. Запустите вручную: node "{path}"',
};

export const MESSAGES: Record<Language, Record<MessageKey, string>> = { en: EN, ru: RU };

export function message(language: Language, key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[language][key].replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
