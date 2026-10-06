<script setup lang="ts">
import { dismiss, toasts } from '../api.ts';
import { t } from '../i18n/index.ts';
</script>

<template>
  <div class="toasts">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      role="status"
      class="toast"
      :class="{ 'toast-error': toast.kind === 'error' }"
    >
      <span class="toast-text">{{ toast.message }}</span>
      <button type="button" class="toast-close" :aria-label="t('Close')" @click="dismiss(toast.id)">✕</button>
    </div>
  </div>
</template>
