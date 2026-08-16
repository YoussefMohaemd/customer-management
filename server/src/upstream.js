import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, configPath } from './config.js';

let token = null;

/**
 * Loads the upstream Bearer token.
 *
 * Priority:
 *   1. BFF_UPSTREAM_TOKEN environment variable (deployments).
 *   2. The git-ignored runtime config the Angular app also reads
 *      (`public/config/app-config.json` — the BFF runs from `server/`, so the
 *      default path resolves to `../public/config/app-config.json`).
 */
export function loadToken() {
  if (process.env.BFF_UPSTREAM_TOKEN) {
    token = { scheme: 'Bearer', value: process.env.BFF_UPSTREAM_TOKEN };
    return token;
  }

  const tokenPath = path.resolve(path.dirname(configPath()), config.token.path);
  let raw;
  try {
    raw = JSON.parse(readFileSync(tokenPath, 'utf8'));
  } catch {
    throw new Error(
      `Upstream token configuration could not be read at "${tokenPath}". ` +
        'Copy public/config/app-config.example.json to public/config/app-config.json with ' +
        'your assessment token, or set BFF_UPSTREAM_TOKEN.',
    );
  }

  const scheme = raw.auth?.scheme?.trim() || 'Bearer';
  const value = raw.auth?.token?.trim() ?? '';
  if (!value) {
    throw new Error(`No upstream token found in "${tokenPath}".`);
  }
  token = { scheme, value };
  return token;
}

/**
 * Fetches the full customer dataset from `ReadAllCRMClients`.
 *
 * The staging API ignores ALL query parameters (verified live: `Text`,
 * `Direction`, `InCT`, `Page`, `PageSize`, `Skip`, `Take`, `offset`, `limit`
 * all return the byte-identical 14,111-record dump) and returns
 * `{ "Data": Client[], "Total": number }`. This function therefore performs a
 * plain GET without parameters and extracts the collection. Single-flight:
 * concurrent callers share one in-flight request.
 */
export function fetchCustomerDataset() {
  const url = config.upstream.readUrl;
  let pending = inflight.get(url);
  if (pending) {
    return pending;
  }
  pending = fetchDatasetOnce(url)
    .catch((error) => {
      inflight.delete(url);
      throw error;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, pending);
  return pending;
}

async function fetchDatasetOnce(url) {
  const started = Date.now();
  const headers = authorizationHeaders();
  let response = await request(url, headers);

  // The token may have rotated on the server; reload the config and retry once.
  if (response.status === 401) {
    token = null;
    loadToken();
    response = await request(url, authorizationHeaders());
  }

  if (!response.ok) {
    throw new Error(
      `Upstream CRM read failed with HTTP ${response.status} ${response.statusText} ` +
        `after ${Date.now() - started} ms.`,
    );
  }

  const json = await response.json();
  const data = extractCollection(json);
  const total = readTotal(json, data.length);

  if (data.length === 0 && total === 0) {
    throw new Error('Upstream CRM returned an empty dataset — refusing to cache nothing.');
  }

  return { records: data, total, upstreamFetchMs: Date.now() - started };
}

/**
 * Proxies the SaveCustomerWithContactPerson upsert to the upstream API.
 * Returns the upstream response body unchanged (the Angular normalizer already
 * understands every documented response shape).
 */
export async function proxySave(payload) {
  const url = `${config.upstream.baseUrl}${config.upstream.saveEndpoint}?InCT=`;
  const started = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...authorizationHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.upstream.timeoutMs),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, latencyMs: Date.now() - started };
}

async function request(url, headers) {
  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(config.upstream.timeoutMs),
  });
}

function authorizationHeaders() {
  const current = token ?? loadToken();
  return { Authorization: `${current.scheme} ${current.value}` };
}

/** Extracts the customer collection from the response body (defensive). */
function extractCollection(json) {
  if (Array.isArray(json)) {
    return json;
  }
  if (typeof json !== 'object' || json === null) {
    return [];
  }
  if (Array.isArray(json.Data)) {
    return json.Data;
  }
  if (Array.isArray(json.data)) {
    return json.data;
  }
  const nested = json.Result ?? json.result ?? json.Payload ?? json.payload;
  if (typeof nested === 'object' && nested !== null) {
    if (Array.isArray(nested.Data)) {
      return nested.Data;
    }
    if (Array.isArray(nested.data)) {
      return nested.data;
    }
  }
  return [];
}

function readTotal(json, fallback) {
  if (typeof json !== 'object' || json === null) {
    return fallback;
  }
  const value = json.Total ?? json.total ?? json.totalCount ?? json.count;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const inflight = new Map();
