<script setup lang="ts">
import { onMounted } from 'vue';

import { connection } from './api.ts';
import Settings from './components/Settings.vue';
import Toasts from './components/Toasts.vue';
import { t } from './i18n/index.ts';
import { refresh, store, toggleEnabled } from './store.ts';

onMounted(() => {
  void refresh().catch(() => undefined);
});
</script>

<template>
  <div class="page">
    <header class="header">
      <h1 class="title">{{ store.health?.title ?? '…' }}</h1>
      <button
        type="button"
        class="badge"
        :class="store.config === null ? 'badge-gray' : store.config.enabled ? 'badge-green' : 'badge-red'"
        :disabled="store.config === null"
        :title="store.config?.enabled ? t('Click to turn the mod off') : t('Click to turn the mod on')"
        @click="toggleEnabled().catch(() => undefined)"
      >
        <span class="dot" :class="{ 'dot-on': store.config?.enabled }" />
        {{ store.config === null ? '…' : store.config.enabled ? t('On') : t('Off') }}
      </button>
    </header>

    <div v-if="!connection.ok" class="alert">
      {{ t('No connection to the server. Check that it is running:') }} <code class="mono">npm run dev</code>.
    </div>

    <main>
      <Settings />
    </main>
    <Toasts />
  </div>
</template>
