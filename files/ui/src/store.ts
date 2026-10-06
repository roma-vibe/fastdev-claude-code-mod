import { reactive, watch } from 'vue';

import { api, type Health, type ModConfig } from './api.ts';
import { setLang } from './i18n/index.ts';

/** The settings and the server's identity, shared by the header and the settings form. */
export const store = reactive<{ config: ModConfig | null; health: Health | null }>({ config: null, health: null });

// The saved language wins over the one remembered in this browser.
watch(
  () => store.config?.language,
  (language) => {
    if (language) setLang(language);
  },
  { flush: 'sync' },
);

export async function refresh(): Promise<void> {
  store.config = await api.config();
  store.health = await api.health();
}

export async function toggleEnabled(): Promise<void> {
  if (!store.config) return;
  store.config = await api.saveConfig({ enabled: !store.config.enabled });
}
