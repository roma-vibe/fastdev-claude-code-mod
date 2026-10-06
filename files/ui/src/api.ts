import { reactive } from 'vue';

import type { ConfigPatch, ModConfig } from '../../hooks/lib/config.ts';
import { lang, t } from './i18n/index.ts';

export type { ConfigPatch, ModConfig };
export type Health = { ok: true; name: string; title: string; version: string; data: string };

export type Toast = { id: number; kind: 'error' | 'ok'; message: string };
export const toasts = reactive<Toast[]>([]);
export const connection = reactive({ ok: true });
let toastId = 0;

export function notify(message: string, kind: Toast['kind'] = 'ok'): void {
  const id = ++toastId;
  toasts.push({ id, kind, message });
  setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 3500);
}

export function dismiss(id: number): void {
  const i = toasts.findIndex((toast) => toast.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

class ApiError extends Error {}

/** Sends one request; failures are shown as a toast unless `quiet`, and thrown for the caller. */
async function request<T>(method: string, url: string, body?: unknown, quiet = false): Promise<T> {
  const mutating = method !== 'GET';
  const headers: Record<string, string> = { accept: 'application/json', 'X-Mod-Lang': lang.value };
  if (mutating) {
    headers['X-Mod-Request'] = '1';
    headers['Content-Type'] = 'application/json';
  }
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: mutating && body !== undefined ? JSON.stringify(body) : undefined,
    });
    connection.ok = true;
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    if (!response.ok) {
      const message =
        typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
          ? data.error
          : t('Error {status}', { status: response.status });
      throw new ApiError(message);
    }
    return data as T;
  } catch (caught) {
    if (!(caught instanceof ApiError)) connection.ok = false;
    const error = caught instanceof ApiError ? caught : new ApiError(t('No connection to the settings server.'));
    if (!quiet) notify(error.message, 'error');
    throw error;
  }
}

export const api = {
  health: () => request<Health>('GET', '/api/health', undefined, true),
  config: () => request<ModConfig>('GET', '/api/config'),
  saveConfig: (patch: ConfigPatch) => request<ModConfig>('PUT', '/api/config', patch),
  resetConfig: () => request<ModConfig>('POST', '/api/config/reset', {}),
};
