<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { api, notify } from '../api.ts';
import { t } from '../i18n/index.ts';
import { getFields, type FormValues } from '../settingsSchema.ts';
import { store } from '../store.ts';

const form = ref<FormValues | null>(null);
const baseline = ref('');
const saving = ref(false);

/** Rebuilt when the language changes, so labels and help follow it. */
const fields = computed(() => getFields());
const dirty = computed(() => form.value !== null && JSON.stringify(form.value) !== baseline.value);

function sync(): void {
  const config = store.config;
  if (!config) return;
  form.value = { language: config.language, greeting: config.greeting };
  baseline.value = JSON.stringify(form.value);
}

// Adopt the loaded settings (and changes made elsewhere) unless there are unsaved edits.
watch(
  () => store.config,
  () => {
    if (!dirty.value) sync();
  },
  { immediate: true },
);

async function save(): Promise<void> {
  if (!form.value) return;
  saving.value = true;
  try {
    store.config = await api.saveConfig(form.value);
    sync();
    notify(t('Settings saved. The mod picks them up on the next turn.'));
  } catch {
    // shown as a toast
  } finally {
    saving.value = false;
  }
}

async function reset(): Promise<void> {
  if (!window.confirm(t('Reset all settings to their defaults?'))) return;
  try {
    store.config = await api.resetConfig();
    sync();
    notify(t('Settings reset.'));
  } catch {
    // shown as a toast
  }
}
</script>

<template>
  <form v-if="form" class="stack" @submit.prevent="save">
    <section class="card stack">
      <h2 class="card-title">{{ t('Settings') }}</h2>
      <div v-for="field in fields" :key="field.key" class="field">
        <label class="label" :for="`field-${field.key}`">{{ field.label }}</label>
        <select
          v-if="field.kind === 'select'"
          :id="`field-${field.key}`"
          v-model="form[field.key]"
          class="input input-narrow"
        >
          <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <input
          v-else
          :id="`field-${field.key}`"
          v-model="form[field.key]"
          class="input"
          type="text"
          :maxlength="field.maxLength"
          required
        />
        <p class="help">{{ field.help }}</p>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">{{ t('In Claude Code') }}</h2>
      <p v-if="store.config?.enabled" class="mono sample">
        {{ form.greeting }}
      </p>
      <p v-else class="help">{{ t('The mod is off: nothing is shown.') }}</p>
      <p v-if="store.health" class="help">
        {{
          t('Type /{command} in Claude Code for its status and /{command} ui for this page.', {
            command: store.health.name,
          })
        }}
      </p>
      <p v-if="store.health" class="help">
        {{ t('Data folder') }}: <span class="mono">{{ store.health.data }}</span>
      </p>
    </section>

    <div class="row">
      <button type="submit" class="btn btn-primary" :disabled="!dirty || saving">{{ t('Save') }}</button>
      <button type="button" class="btn btn-danger" @click="reset">{{ t('Reset to defaults') }}</button>
    </div>
  </form>
</template>
