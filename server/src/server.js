import { createServer } from 'node:http';
import { config } from './config.js';
import { cacheStatus, getDataset, invalidate, getCachedOrNull } from './cache.js';
import { buildLookups, queryDataset } from './query.js';
import { proxySave } from './upstream.js';

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * BFF HTTP server.
 *
 * Routes (all JSON):
 *   GET  /api/health             → cache/upstream diagnostics
 *   GET  /api/customers          → paged table state (page, pageSize, search,
 *                                  sortField, sortDirection, categorical ids,
 *                                  textFilters/textOperators JSON, report id)
 *   GET  /api/customers/export   → full matching set (search + filters + sort)
 *   GET  /api/customers/lookups  → distinct filter dropdown options
 *   POST /api/customers/save     → SaveCustomerWithContactPerson proxy;
 *                                  marks the cache stale on success
 */
export function startServer() {
  const server = createServer(async (request, response) => {
    applyCors(request, response);
    if (request.method === 'OPTIONS') {
      respond(response, 204, null);
      return;
    }

    try {
      await route(request, response);
    } catch (error) {
      const status = Number(error?.status) || 500;
      respond(
        response,
        status,
        { error: String(error?.message ?? 'Internal server error') },
        status === 500,
      );
    }
  });

  server.listen(config.port, () => {
    console.log(`[bff] listening on http://localhost:${config.port}`);
    console.log(`[bff] upstream: ${config.upstream.readUrl}`);
    console.log(
      `[bff] cache: fresh=${config.cache.freshMs}ms, maxStale=${config.cache.maxStaleMs}ms`,
    );
  });
  return server;
}

async function route(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const method = request.method ?? 'GET';
  const path = url.pathname;

  if (method === 'GET' && path === '/api/health') {
    respond(response, 200, {
      status: 'ok',
      cache: cacheStatus(),
      upstream: {
        url: config.upstream.readUrl,
        supportsPagination: false,
        returnsFullDataset: true,
      },
    });
    return;
  }

  if (method === 'GET' && path === '/api/customers/lookups') {
    const records = await getDataset();
    respond(response, 200, buildLookups(records));
    return;
  }

  if (method === 'GET' && path === '/api/customers/export') {
    const records = await getDataset();
    const { data, totalCount } = queryDataset(records, url.searchParams, { paginate: false });
    respond(response, 200, { data, totalCount });
    return;
  }

  if (method === 'GET' && path === '/api/customers') {
    const records = await getDataset();
    const result = queryDataset(records, url.searchParams, { paginate: true });
    respond(response, 200, result);
    return;
  }

  if (method === 'POST' && path === '/api/customers/save') {
    const body = await readJsonBody(request);
    const { status, body: upstreamBody, latencyMs } = await proxySave(body);
    if (status >= 200 && status < 300) {
      // The dataset changed upstream; keep serving instantly (stale) while a
      // background refresh re-downloads it.
      invalidate();
    }
    respond(response, status, upstreamBody);
    return;
  }

  respond(response, 404, { error: `No such route: ${method} ${path}` });
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  const allowed = config.cors.allowedOrigins;
  const allowedOrigin = allowed.includes('*') || (origin && allowed.includes(origin)) ? origin ?? '*' : allowed[0] ?? '*';
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Max-Age', '600');
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body exceeds 1 MB.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Request body is not valid JSON.');
    error.status = 400;
    throw error;
  }
}

function respond(response, status, payload, log = false) {
  const body = payload === null ? '' : JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
  if (log) {
    console.error(`[bff] error response ${status}: ${body.slice(0, 400)}`);
  }
}