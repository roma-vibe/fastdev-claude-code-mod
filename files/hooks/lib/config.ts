// The mod's settings: one JSON file shared by the hooks (read) and the settings
// UI (read and written). Pure code: it runs in the Claude Code engine, in Node
// and in the browser, so it uses no Node, DOM or engine API.

export const LANGUAGES = ['en', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_GREETING = 'Hello from fastDev';
export const GREETING_MAX = 120;

export type ModConfig = {
  /** Format version of the file, for future migrations. */
  version: 1;
  /** Main switch: when off, the mod shows nothing in Claude Code. */
  enabled: boolean;
  /** Language of the settings UI and of the mod's own messages. */
  language: Language;
  /** The text the mod puts in Claude Code (status line and the command's answer). */
  greeting: string;
};

export const DEFAULT_CONFIG: ModConfig = {
  version: 1,
  enabled: true,
  language: 'en',
  greeting: DEFAULT_GREETING,
};

/** What the UI may change: every setting but the format version. */
export type ConfigPatch = Partial<Omit<ModConfig, 'version'>>;

export type PatchIssue = {
  field: string;
  reason: 'type' | 'empty' | 'too-long' | 'unsupported' | 'unknown-field';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

// eslint-disable-next-line no-control-regex -- control characters are what this removes
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]+/g;

/** One line, single spaces, no control characters. */
export function singleLine(text: string): string {
  return text.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
}

/** Reads a settings file's content; whatever is missing or invalid falls back to the default. */
export function resolveConfig(raw: unknown): ModConfig {
  if (!isRecord(raw)) return DEFAULT_CONFIG;
  const greeting = typeof raw.greeting === 'string' ? singleLine(raw.greeting) : '';
  return {
    version: 1,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_CONFIG.enabled,
    language: isLanguage(raw.language) ? raw.language : DEFAULT_CONFIG.language,
    greeting: greeting !== '' ? greeting.slice(0, GREETING_MAX) : DEFAULT_CONFIG.greeting,
  };
}

/** Checks the body of a settings change strictly: unknown or invalid fields are reported, not dropped. */
export function parsePatch(input: Record<string, unknown>): { patch: ConfigPatch; issues: PatchIssue[] } {
  const patch: ConfigPatch = {};
  const issues: PatchIssue[] = [];
  for (const [field, value] of Object.entries(input)) {
    if (field === 'enabled') {
      if (typeof value === 'boolean') patch.enabled = value;
      else issues.push({ field, reason: 'type' });
    } else if (field === 'language') {
      if (typeof value !== 'string') issues.push({ field, reason: 'type' });
      else if (isLanguage(value)) patch.language = value;
      else issues.push({ field, reason: 'unsupported' });
    } else if (field === 'greeting') {
      if (typeof value !== 'string') issues.push({ field, reason: 'type' });
      else if (singleLine(value) === '') issues.push({ field, reason: 'empty' });
      else if (singleLine(value).length > GREETING_MAX) issues.push({ field, reason: 'too-long' });
      else patch.greeting = singleLine(value);
    } else {
      issues.push({ field, reason: 'unknown-field' });
    }
  }
  return { patch, issues };
}
