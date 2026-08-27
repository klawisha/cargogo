import * as SecureStore from 'expo-secure-store';

const KEY = 'cargogo.api.endpoint.override.v1';
const rawDefault = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3000/v1';

export const API_OVERRIDE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_API_OVERRIDE === '1';

function parseAndNormalize(input: string): string {
  const clean = input.trim();
  if (!clean) throw new Error('Вкажіть адресу API');
  let url: URL;
  try { url = new URL(clean); } catch { throw new Error('Некоректна URL-адреса'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Підтримуються тільки http:// та https://');
  if (url.username || url.password) throw new Error('URL не повинен містити логін або пароль');
  if (url.search || url.hash) throw new Error('URL не повинен містити query або fragment');

  let path = url.pathname.replace(/\/+$/, '');
  if (!path) path = '/v1';
  else if (path !== '/v1') throw new Error('Вкажіть адресу сервера без шляху або з /v1');
  url.pathname = path;
  return url.toString().replace(/\/$/, '');
}

export const DEFAULT_API_URL = parseAndNormalize(rawDefault);
let cachedOverride: string | null | undefined;

export function normalizeApiEndpoint(input: string) { return parseAndNormalize(input); }

export async function getApiUrl(): Promise<string> {
  if (!API_OVERRIDE_ENABLED) return DEFAULT_API_URL;
  if (cachedOverride !== undefined) return cachedOverride || DEFAULT_API_URL;
  const stored = await SecureStore.getItemAsync(KEY);
  if (!stored) { cachedOverride = null; return DEFAULT_API_URL; }
  try {
    cachedOverride = parseAndNormalize(stored);
    return cachedOverride;
  } catch {
    await SecureStore.deleteItemAsync(KEY);
    cachedOverride = null;
    return DEFAULT_API_URL;
  }
}

export async function getApiOverride(): Promise<string | null> {
  if (!API_OVERRIDE_ENABLED) return null;
  await getApiUrl();
  return cachedOverride || null;
}

export async function setApiOverride(input: string): Promise<string> {
  if (!API_OVERRIDE_ENABLED) throw new Error('API override вимкнено для цієї збірки');
  const normalized = parseAndNormalize(input);
  await SecureStore.setItemAsync(KEY, normalized, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  cachedOverride = normalized;
  return normalized;
}

export async function resetApiOverride(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
  cachedOverride = null;
}

export function endpointHeaders(endpoint: string): Record<string, string> {
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    if (host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok.app')) return { 'ngrok-skip-browser-warning': 'cargogo-dev' };
  } catch {}
  return {};
}

export type ApiProbeResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  endpoint: string;
  data: any;
  message: string;
};

export async function probeApiEndpoint(input: string, timeoutMs = 8000): Promise<ApiProbeResult> {
  const endpoint = parseAndNormalize(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${endpoint}/health/ready`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...endpointHeaders(endpoint) },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      endpoint,
      data,
      message: response.ok ? 'CargoGo API доступний' : `API відповів HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      endpoint,
      data: null,
      message: error instanceof Error && error.name === 'AbortError' ? 'Таймаут з’єднання з API' : (error instanceof Error ? error.message : 'Не вдалося підключитися'),
    };
  } finally {
    clearTimeout(timeout);
  }
}
