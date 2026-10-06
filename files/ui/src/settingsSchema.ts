// The fields of the settings form. To add a setting: a field in hooks/lib/config.ts
// (type, default, resolveConfig, parsePatch), an entry here, and a Russian text in i18n/ru.ts.

import { GREETING_MAX, type ModConfig } from '../../hooks/lib/config.ts';
import { LANGS, t } from './i18n/index.ts';

export type FieldDef =
  | { key: 'language'; kind: 'select'; label: string; help: string; options: { value: string; label: string }[] }
  | { key: 'greeting'; kind: 'text'; label: string; help: string; maxLength: number };

/** Built on every call, so the texts follow the current language. */
export function getFields(): FieldDef[] {
  return [
    {
      key: 'language',
      kind: 'select',
      label: t('Interface language'),
      help: t('Language of this page and of the mod’s own messages in Claude Code.'),
      options: LANGS,
    },
    {
      key: 'greeting',
      kind: 'text',
      label: t('Greeting'),
      help: t('The text the mod shows in Claude Code’s status line. Up to {max} characters.', { max: GREETING_MAX }),
      maxLength: GREETING_MAX,
    },
  ];
}

/** The settings the form edits. */
export type FormValues = Pick<ModConfig, 'language' | 'greeting'>;
