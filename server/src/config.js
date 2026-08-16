import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CONFIG_PATH = process.env.BFF_CONFIG_PATH ?? path.join(dirname(), '..', 'config.json');

export const config = loadConfig();

export function configPath() {
  return CONFIG_PATH;
}

function dirname() {
  return path.dirname(fileURLToPath(import.meta.url));
}

function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

  const port = toInt(process.env.BFF_PORT ?? process.env.PORT, raw.port ?? 3000, 1, 65535);
  const upstreamBaseUrl = envOr('BFF_UPSTREAM_BASE_URL', raw.upstream?.baseUrl);
  const readEndpoint = envOr('BFF_READ_ENDPOINT', raw.upstream?.readAllCrmClients);
  const saveEndpoint = envOr('BFF_SAVE_ENDPOINT', raw.upstream?.saveCustomerWithContactPerson);
  const direction = envOr('BFF_UPSTREAM_DIRECTION', raw.upstream?.direction ?? 'ltr');
  const timeoutMs = toInt(process.env.BFF_TIMEOUT_MS, raw.upstream?.timeoutMs ?? 120000, 1000, 600000);
  const freshMs = toInt(process.env.BFF_FRESH_MS, raw.cache?.freshMs ?? 300000, 0, 86400000);
  const maxStaleMs = toInt(
    process.env.BFF_MAX_STALE_MS,
    raw.cache?.maxStaleMs ?? 3600000,
    freshMs,
    86400000 * 7,
  );

  const allowedOrigins = (envOr('BFF_ALLOW_ORIGIN', '') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port,
    upstream: {
      baseUrl: upstreamBaseUrl.replace(/\/+$/, ''),
      readEndpoint,
      saveEndpoint,
      direction,
      timeoutMs,
      // The upstream 404s when the documented parameters are absent; `Text`
      // itself is ignored (verified live), but the parameter must exist.
      readUrl: `${upstreamBaseUrl.replace(/\/+$/, '')}${readEndpoint}?Text=&Direction=${encodeURIComponent(direction)}&InCT=`,
    },
    cache: { freshMs, maxStaleMs },
    token: { path: envOr('BFF_TOKEN_PATH', raw.token?.path ?? '../public/config/app-config.json') },
    cors: { allowedOrigins },
  };
}

function envOr(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function toInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}
