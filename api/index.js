import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Memory cache for dataset across lambdas in warm execution contexts
let cachedDataset = null;
let cacheTimestamp = 0;
let inflightPromise = null;

const CACHE_FRESH_MS = 300000; // 5 mins
const UPSTREAM_BASE_URL = process.env.BFF_UPSTREAM_BASE_URL || 'https://testmobapi.erppluscloud.com';
const READ_ENDPOINT = process.env.BFF_READ_ENDPOINT || '/api/CRM/ReadAllCRMClients';
const SAVE_ENDPOINT = process.env.BFF_SAVE_ENDPOINT || '/api/CRM/SaveCustomerWithContactPerson';
const DIRECTION = process.env.BFF_UPSTREAM_DIRECTION || 'ltr';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    // Health Endpoint
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api/health/')) {
      res.status(200).json({
        status: 'ok',
        environment: 'vercel-serverless',
        cache: {
          hasData: cachedDataset !== null,
          recordCount: cachedDataset ? cachedDataset.length : 0,
          ageMs: cacheTimestamp ? Date.now() - cacheTimestamp : 0,
        },
        upstream: {
          url: `${UPSTREAM_BASE_URL}${READ_ENDPOINT}`,
        },
      });
      return;
    }

    // Lookups Endpoint
    if (req.method === 'GET' && (pathname === '/api/customers/lookups' || pathname === '/api/customers/lookups/')) {
      const authHeader = extractAuthHeader(req);
      const records = await getDataset(authHeader);
      res.status(200).json(buildLookups(records));
      return;
    }

    // Export Endpoint
    if (req.method === 'GET' && (pathname === '/api/customers/export' || pathname === '/api/customers/export/')) {
      const authHeader = extractAuthHeader(req);
      const records = await getDataset(authHeader);
      const { data, totalCount } = queryDataset(records, searchParams, { paginate: false });
      res.status(200).json({ data, totalCount });
      return;
    }

    // Customer Paged List Endpoint
    if (req.method === 'GET' && (pathname === '/api/customers' || pathname === '/api/customers/')) {
      const authHeader = extractAuthHeader(req);
      const records = await getDataset(authHeader);
      const result = queryDataset(records, searchParams, { paginate: true });
      res.status(200).json(result);
      return;
    }

    // Save Customer Proxy Endpoint
    if (req.method === 'POST' && (pathname === '/api/customers/save' || pathname === '/api/customers/save/')) {
      const authHeader = extractAuthHeader(req);
      const body = req.body || {};
      const { status, body: upstreamBody } = await proxySave(body, authHeader);
      if (status >= 200 && status < 300) {
        // Invalidate in-memory cache so next GET re-fetches
        cachedDataset = null;
        cacheTimestamp = 0;
      }
      res.status(status).json(upstreamBody);
      return;
    }

    res.status(404).json({ error: `Route not found: ${req.method} ${pathname}` });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error(`[BFF Error] ${error?.message || error}`);
    res.status(status).json({
      error: String(error?.message || 'Internal server error'),
    });
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/** Extracts the Authorization header from browser req, or falls back to Vercel env var or local config. */
function extractAuthHeader(req) {
  const clientAuth = req.headers.authorization;
  if (clientAuth && clientAuth.trim().length > 10) {
    return clientAuth.trim();
  }

  if (process.env.BFF_UPSTREAM_TOKEN) {
    const token = process.env.BFF_UPSTREAM_TOKEN.trim();
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Local filesystem config fallback (if present in local dev)
  try {
    const configPath = path.join(process.cwd(), 'public', 'config', 'app-config.json');
    if (existsSync(configPath)) {
      const raw = JSON.parse(readFileSync(configPath, 'utf8'));
      const token = raw.auth?.token?.trim();
      if (token) {
        return `Bearer ${token}`;
      }
    }
  } catch {
    // Ignore fallback read errors
  }

  return '';
}

async function getDataset(authHeader) {
  const now = Date.now();
  if (cachedDataset && now - cacheTimestamp < CACHE_FRESH_MS) {
    return cachedDataset;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = fetchUpstreamDataset(authHeader)
    .then((records) => {
      cachedDataset = records;
      cacheTimestamp = Date.now();
      inflightPromise = null;
      return records;
    })
    .catch((err) => {
      inflightPromise = null;
      // If we have stale cache, return it on upstream failure
      if (cachedDataset) {
        console.warn('[BFF] Upstream read failed, serving stale dataset');
        return cachedDataset;
      }
      throw err;
    });

  return inflightPromise;
}

async function fetchUpstreamDataset(authHeader) {
  const url = `${UPSTREAM_BASE_URL}${READ_ENDPOINT}?Text=&Direction=${encodeURIComponent(DIRECTION)}&InCT=`;
  const headers = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    throw new Error(`Upstream ERP API read failed with HTTP ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const collection = extractCollection(json);
  if (!collection || collection.length === 0) {
    throw new Error('Upstream ERP API returned empty customer dataset.');
  }

  return collection;
}

async function proxySave(payload, authHeader) {
  const url = `${UPSTREAM_BASE_URL}${SAVE_ENDPOINT}?InCT=`;
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

function extractCollection(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  if (Array.isArray(json.Data)) return json.Data;
  if (Array.isArray(json.data)) return json.data;
  const nested = json.Result || json.result || json.Payload || json.payload;
  if (nested && typeof nested === 'object') {
    if (Array.isArray(nested.Data)) return nested.Data;
    if (Array.isArray(nested.data)) return nested.data;
  }
  return [];
}

/** Queries, filters, sorts, and paginates in-memory dataset */
function queryDataset(records, searchParams, { paginate = true }) {
  let list = [...records];

  const search = (searchParams.get('search') || '').trim().toLowerCase();
  if (search) {
    list = list.filter((item) => {
      const code = String(item.Code || '').toLowerCase();
      const comm = String(item.CommercialName || '').toLowerCase();
      const en = String(item.NameEN || '').toLowerCase();
      const ar = String(item.NameAR || '').toLowerCase();
      const email = String(item.Email || '').toLowerCase();
      const mobile = String(item.Mobile || '').toLowerCase();
      const phone = String(item.Phone || '').toLowerCase();
      return (
        code.includes(search) ||
        comm.includes(search) ||
        en.includes(search) ||
        ar.includes(search) ||
        email.includes(search) ||
        mobile.includes(search) ||
        phone.includes(search)
      );
    });
  }

  // Categorical filters
  const clientTypeId = searchParams.get('clientTypeId');
  if (clientTypeId !== null && clientTypeId !== undefined && clientTypeId !== '') {
    const id = Number(clientTypeId);
    list = list.filter((item) => Number(item.ClientTypeId || item.AccountTypeId) === id);
  }

  const accountManagerId = searchParams.get('accountManagerId');
  if (accountManagerId !== null && accountManagerId !== undefined && accountManagerId !== '') {
    const id = Number(accountManagerId);
    list = list.filter((item) => Number(item.AccountManagerId) === id);
  }

  const cityId = searchParams.get('cityId');
  if (cityId !== null && cityId !== undefined && cityId !== '') {
    const id = Number(cityId);
    list = list.filter((item) => Number(item.CityId) === id);
  }

  const countryId = searchParams.get('countryId');
  if (countryId !== null && countryId !== undefined && countryId !== '') {
    const id = Number(countryId);
    list = list.filter((item) => Number(item.CountryId) === id);
  }

  // Reports filters
  const report = searchParams.get('report');
  if (report) {
    if (report === 'active') {
      list = list.filter((item) => item.Status === true || item.Status === 'Active' || item.Status === 1);
    } else if (report === 'inactive') {
      list = list.filter((item) => item.Status === false || item.Status === 'Inactive' || item.Status === 0);
    }
  }

  // Text filters
  const textFiltersRaw = searchParams.get('textFilters');
  const textOperatorsRaw = searchParams.get('textOperators');
  if (textFiltersRaw) {
    try {
      const filters = JSON.parse(textFiltersRaw);
      const operators = textOperatorsRaw ? JSON.parse(textOperatorsRaw) : {};
      for (const [key, val] of Object.entries(filters)) {
        const queryVal = String(val).trim().toLowerCase();
        if (!queryVal) continue;
        const op = operators[key] || 'contains';
        const apiKey = MAP_FE_KEY_TO_API[key] || key;

        list = list.filter((item) => {
          const itemVal = String(item[apiKey] ?? '').toLowerCase();
          if (op === 'startsWith') return itemVal.startsWith(queryVal);
          if (op === 'endsWith') return itemVal.endsWith(queryVal);
          if (op === 'equals') return itemVal === queryVal;
          return itemVal.includes(queryVal);
        });
      }
    } catch {
      // Ignore text filter parsing error
    }
  }

  // Sorting
  const sortField = searchParams.get('sortField');
  const sortDirection = (searchParams.get('sortDirection') || 'asc').toLowerCase();
  if (sortField) {
    const dir = sortDirection === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB)) * dir;
    });
  }

  const totalCount = list.length;
  if (!paginate) {
    return { data: list, totalCount };
  }

  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.max(1, Number(searchParams.get('pageSize') || 5));
  const start = (page - 1) * pageSize;
  const data = list.slice(start, start + pageSize);

  return { data, totalCount };
}

const MAP_FE_KEY_TO_API = {
  id: 'Id',
  code: 'Code',
  commercialName: 'CommercialName',
  nameEn: 'NameEN',
  nameAr: 'NameAR',
  email: 'Email',
  mobile: 'Mobile',
  phone: 'Phone',
  phone2: 'Phone2',
  fax: 'Fax',
  website: 'Website',
  jobTitle: 'JobTitle',
  accountTypeName: 'AccountTypeName',
  accountManagerName: 'AccountManagerName',
  city: 'CityName',
  country: 'CountryName',
  classificationName: 'ClassificationName',
  businessFieldName: 'BusinessFieldName',
  regionName: 'RegionName',
  address: 'Address',
  comment: 'Comment',
  taxFileNumber: 'TaxFileNumber',
  commercialRegistrationNumber: 'CommercialRegistrationNumber',
  vatRegistrationNumber: 'VATRegistrationNumber',
};

function buildLookups(records) {
  const clientTypesMap = new Map();
  const accountManagersMap = new Map();
  const citiesMap = new Map();
  const countriesMap = new Map();

  for (const item of records) {
    if (item.ClientTypeId && item.AccountTypeName) {
      clientTypesMap.set(Number(item.ClientTypeId), String(item.AccountTypeName));
    } else if (item.AccountTypeId && item.AccountTypeName) {
      clientTypesMap.set(Number(item.AccountTypeId), String(item.AccountTypeName));
    }

    if (item.AccountManagerId && item.AccountManagerName) {
      accountManagersMap.set(Number(item.AccountManagerId), String(item.AccountManagerName));
    }
    if (item.CityId && item.CityName) {
      citiesMap.set(Number(item.CityId), String(item.CityName));
    }
    if (item.CountryId && item.CountryName) {
      countriesMap.set(Number(item.CountryId), String(item.CountryName));
    }
  }

  return {
    clientTypes: mapToOptions(clientTypesMap),
    accountManagers: mapToOptions(accountManagersMap),
    cities: mapToOptions(citiesMap),
    countries: mapToOptions(countriesMap),
  };
}

function mapToOptions(map) {
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
