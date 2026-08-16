import { createServer } from 'node:http';
import { URL } from 'node:url';

const UPSTREAM_READ_URL =
  'https://testmobapi.erppluscloud.com/api/CRM/ReadAllCRMClients?Text=&Direction=ltr&InCT=';
const UPSTREAM_SAVE_URL =
  'https://testmobapi.erppluscloud.com/api/CRM/SaveCustomerWithContactPerson?InCT=';
const TIMEOUT_MS = 120000;

export default async function handler(req, res) {
  // Always return JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Handle CORS if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  // 0. Runtime configuration endpoint for app initialization
  if (method === 'GET' && (pathname === '/config/app-config.json' || pathname === '/api/config')) {
    let token = process.env.BFF_UPSTREAM_TOKEN || process.env.AUTH_TOKEN || '';
    if (!token) {
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const configPath = path.join(process.cwd(), 'public', 'config', 'app-config.json');
        if (fs.existsSync(configPath)) {
          const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          token = parsed?.auth?.token ?? '';
        }
      } catch {
        // Fallback if file not accessible
      }
    }
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        auth: {
          token: token,
        },
        api: {
          bffBaseUrl: '',
        },
      }),
    );
  }

  // 1. Health check endpoint
  if (method === 'GET' && pathname === '/api/health') {
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // Determine client authorization header
  const authHeader = req.headers.authorization || (process.env.BFF_UPSTREAM_TOKEN ? `Bearer ${process.env.BFF_UPSTREAM_TOKEN}` : '');

  // 2. Main Customers read endpoint
  if (method === 'GET' && (pathname === '/api/customers' || pathname === '/api/customers/export' || pathname === '/api/customers/lookups')) {
    if (!authHeader) {
      res.statusCode = 401;
      return res.end(
        JSON.stringify({
          error: 'Authorization header is missing. Please provide a Bearer token.',
          status: 401,
        }),
      );
    }

    try {
      const upstreamResponse = await fetch(UPSTREAM_READ_URL, {
        headers: {
          Authorization: authHeader,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text().catch(() => '');
        res.statusCode = upstreamResponse.status;
        return res.end(
          JSON.stringify({
            error: `Upstream ERP API failed with HTTP ${upstreamResponse.status}`,
            status: upstreamResponse.status,
            details: errorText.slice(0, 300),
          }),
        );
      }

      const json = await upstreamResponse.json();
      const records = extractCollection(json);
      const total = readTotal(json, records.length);

      if (pathname === '/api/customers/lookups') {
        res.statusCode = 200;
        return res.end(JSON.stringify(buildLookups(records)));
      }

      if (pathname === '/api/customers/export') {
        const { data, totalCount } = queryDataset(records, url.searchParams, { paginate: false });
        res.statusCode = 200;
        return res.end(JSON.stringify({ data, totalCount }));
      }

      // Default GET /api/customers
      const result = queryDataset(records, url.searchParams, { paginate: true });
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 500;
      return res.end(
        JSON.stringify({
          error: String(err?.message ?? 'Failed to reach upstream ERP API'),
          status: 500,
        }),
      );
    }
  }

  // 3. Save Customer endpoint
  if (method === 'POST' && pathname === '/api/customers/save') {
    if (!authHeader) {
      res.statusCode = 401;
      return res.end(
        JSON.stringify({
          error: 'Authorization header is missing. Please provide a Bearer token.',
          status: 401,
        }),
      );
    }

    try {
      const bodyText = await readRequestBody(req);
      const upstreamResponse = await fetch(UPSTREAM_SAVE_URL, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: bodyText,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const responseText = await upstreamResponse.text();
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      res.statusCode = upstreamResponse.status;
      return res.end(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody));
    } catch (err) {
      res.statusCode = 500;
      return res.end(
        JSON.stringify({
          error: String(err?.message ?? 'Failed to proxy save customer request to upstream ERP API'),
          status: 500,
        }),
      );
    }
  }

  res.statusCode = 404;
  return res.end(JSON.stringify({ error: `Route not found: ${method} ${pathname}`, status: 404 }));
}

function extractCollection(json) {
  if (Array.isArray(json)) return json;
  if (typeof json !== 'object' || json === null) return [];
  if (Array.isArray(json.Data)) return json.Data;
  if (Array.isArray(json.data)) return json.data;
  const nested = json.Result ?? json.result ?? json.Payload ?? json.payload;
  if (typeof nested === 'object' && nested !== null) {
    if (Array.isArray(nested.Data)) return nested.Data;
    if (Array.isArray(nested.data)) return nested.data;
  }
  return [];
}

function readTotal(json, fallback) {
  if (typeof json !== 'object' || json === null) return fallback;
  const value = json.Total ?? json.total ?? json.totalCount ?? json.count;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* Helper Query logic for pagination/filtering/sorting */
function queryDataset(records, params, { paginate = true } = {}) {
  let list = records;

  // Search
  const term = (params.get('search') ?? '').trim().toLowerCase();
  if (term) {
    list = list.filter((record) =>
      SEARCH_FIELDS.some((field) => String(record[field] ?? '').toLowerCase().includes(term)),
    );
  }

  // Categorical filters
  for (const [param, field] of Object.entries(CATEGORICAL_FILTER_FIELDS)) {
    const raw = params.get(param);
    if (raw !== null && raw !== '') {
      const id = Number(raw);
      if (Number.isFinite(id)) {
        list = list.filter((record) => Number(record[field]) === id);
      }
    }
  }

  // Text filters
  const textFilters = parseJsonParam(params.get('textFilters'), {});
  const operators = parseJsonParam(params.get('textOperators'), {});
  for (const key of Object.keys(textFilters)) {
    const value = String(textFilters[key] ?? '').trim();
    if (!value) continue;
    const fields = TEXT_FILTER_FIELDS[key];
    if (!fields) continue;
    const operator = String(operators[key] ?? 'contains');
    list = list.filter((record) => matchesText(record, fields, value, operator));
  }

  // Sort
  const sortField = resolveSortField(params.get('sortField'));
  const direction = params.get('sortDirection')?.toLowerCase() === 'desc' ? -1 : 1;
  if (sortField) {
    list = [...list].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (valA === valB) return 0;
      return valA > valB ? direction : -direction;
    });
  }

  const totalCount = list.length;
  let data = list;
  if (paginate) {
    const pageSize = Math.max(1, Number.parseInt(params.get('pageSize') ?? '5', 10));
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10));
    const start = (page - 1) * pageSize;
    data = list.slice(start, start + pageSize);
  }

  return { data, totalCount };
}

function buildLookups(records) {
  return {
    clientTypes: distinctOptions(records, 'AccountTypeId', ['AccountTypeName']),
    accountManagers: distinctOptions(records, 'AccountManagerId', ['AccountManagerName']),
    cities: distinctOptions(records, 'CityId', ['CityName', 'City']),
    countries: distinctOptions(records, 'CountryId', ['CountryName', 'Country']),
  };
}

function distinctOptions(records, idField, labelFields) {
  const seen = new Map();
  for (const record of records) {
    const id = Number(record[idField]);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    const label = firstValue(record, labelFields);
    seen.set(id, label === null ? String(id) : String(label));
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function parseJsonParam(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function matchesText(record, fields, needle, operator) {
  const val = firstValue(record, fields);
  if (val === null) return false;
  const haystack = String(val).toLowerCase();
  const target = needle.toLowerCase();
  switch (operator) {
    case 'equals': return haystack === target;
    case 'startsWith': return haystack.startsWith(target);
    case 'endsWith': return haystack.endsWith(target);
    case 'contains':
    default: return haystack.includes(target);
  }
}

const SEARCH_FIELDS = [
  'CommercialName', 'CommericialName', 'Name', 'NameEN', 'NameAR', 'Code',
  'Email', 'ContEmail', 'MobileWithPrefix', 'Mobile', 'ContMobile',
  'PhoneWithPrefix', 'Phone', 'ContPhone', 'AccountManagerName',
  'CountryName', 'Country', 'CityName', 'City', 'AccountTypeName',
  'ClientType', 'ClassificationNam', 'BusinessFieldName', 'RegionName',
];

const CATEGORICAL_FILTER_FIELDS = {
  clientTypeId: 'AccountTypeId',
  accountManagerId: 'AccountManagerId',
  cityId: 'CityId',
  countryId: 'CountryId',
};

const TEXT_FILTER_FIELDS = {
  id: ['Id', 'ID'],
  code: ['Code', 'code'],
  name: ['CommercialName', 'CommericialName', 'Name', 'NameEN'],
  nameEn: ['NameEN', 'NameEn', 'EnglishName'],
  nameAr: ['NameAR', 'NameAr', 'ArabicName'],
  email: ['Email', 'ContEmail'],
  mobile: ['MobileWithPrefix', 'Mobile', 'ContMobile'],
  phone: ['PhoneWithPrefix', 'Phone', 'ContPhone'],
  clientType: ['ClientType'],
  city: ['CityName', 'City'],
  country: ['CountryName', 'Country'],
};

const CANONICAL_TO_API_FIELD = {
  id: 'Id',
  code: 'Code',
  commercialName: 'CommercialName',
  nameEn: 'NameEN',
  nameAr: 'NameAR',
  clientType: 'ClientType',
  email: 'Email',
  mobile: 'Mobile',
  phone: 'Phone',
  accountManagerName: 'AccountManagerName',
  city: 'CityName',
  country: 'CountryName',
};

function resolveSortField(value) {
  if (!value) return null;
  if (CANONICAL_TO_API_FIELD[value]) return CANONICAL_TO_API_FIELD[value];
  return Object.values(CANONICAL_TO_API_FIELD).includes(value) ? value : null;
}
