import {
  CATEGORICAL_FILTER_FIELDS,
  SEARCH_FIELDS,
  TEXT_FILTER_FIELDS,
  firstValue,
  isReportFieldSet,
  resolveSortField,
} from './fields.js';

/**
 * Server-side report criteria — the single source of truth for what each
 * Reports-section card filters to. Keyed by the canonical report ids the
 * Angular app sends as the `report` query param; expressed on canonical
 * field keys resolved through `REPORT_FIELD_MAP`/`isReportFieldSet` so the
 * BFF never needs to know about frontend presentation concerns.
 *
 * The criteria mirror the declarative `filterCriteria` carried by each
 * report card definition in `customer-reports.component.ts`.
 */
export const CUSTOMER_REPORT_CRITERIA = {
  /** Customers with contact channels on record (email, mobile or phone). */
  contacts: { anyOf: ['email', 'mobile', 'phone'] },
  /** Customers already assigned to an account manager (managed accounts). */
  customers: { allOf: ['accountManagerId'] },
  /** Accounts with no manager assigned yet — the follow-up queue. */
  'account-follow-up': { noneOf: ['accountManagerId'] },
};

/**
 * Server-side table-state pipeline over the cached dataset:
 *
 *   cached records → report criteria → search → categorical filters
 *                   → text filters → sort → paginate → ONLY the requested page
 *
 * Mirrors the client-side semantics the legacy implementation applied over the
 * full dump (same field resolution, same operators, same numeric handling),
 * but runs against the cached dataset on the server, so Angular receives only
 * the current page plus `totalCount`.
 *
 * Performance: both `search` and `sort` are prepared ONCE per cached dataset
 * and reused by every request:
 *
 *   - `search` runs against a precomputed lowercase concatenation of all
 *     searchable fields (one `includes()` per record instead of one per field).
 *   - `sort` compares precomputed "natural sort" keys (numbers as numbers,
 *     text lowercased and tokenized into digit/non-digit chunks) instead of
 *     paying ICU `localeCompare({ numeric: true })` per comparison (~2 s for
 *     14,111 records → single-digit ms).
 *
 * The WeakMap caches are keyed by the dataset array reference, so they are
 * invalidated automatically when a background refresh replaces the dataset.
 */
export function queryDataset(records, params, { paginate = true } = {}) {
  let list = records;

  list = applyReportCriteria(list, params);
  list = applySearch(list, params.get('search'));
  list = applyCategoricalFilters(list, params);
  list = applyTextFilters(list, params);

  const sortField = resolveSortField(params.get('sortField'));
  const direction = params.get('sortDirection')?.toLowerCase() === 'desc' ? -1 : 1;
  if (sortField) {
    list = sortByField(list, sortField, direction);
  }

  const totalCount = list.length;

  let data;
  if (paginate) {
    const pageSize = clampInt(params.get('pageSize'), 5, 1, 100);
    const page = clampInt(params.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
    const start = (page - 1) * pageSize;
    data = list.slice(start, start + pageSize);
  } else {
    data = list;
  }

  return { data, totalCount };
}

/** Distinct { value, label } options for the categorical filter dropdowns. */
export function buildLookups(records) {
  return {
    clientTypes: distinctOptions(records, 'AccountTypeId', ['AccountTypeName']),
    accountManagers: distinctOptions(records, 'AccountManagerId', ['AccountManagerName']),
    cities: distinctOptions(records, 'CityId', ['CityName', 'City']),
    countries: distinctOptions(records, 'CountryId', ['CountryName', 'Country']),
  };
}

/**
 * Per-dataset prepared data (WeakMap keyed by the dataset array reference):
 *   dataset → { searchIndex: string[], sortKeys: Map<field, key[]> }
 * Built lazily on first use; dropped automatically when a background refresh
 * replaces the dataset array.
 */
const searchIndexCache = new WeakMap();
const sortKeyCache = new WeakMap();

/**
 * Applies the active report's server-side criteria (the `report` query param
 * set by the Reports section). Unknown/absent report ids are ignored so a
 * report that is cleared or not yet known leaves the result set untouched.
 */
function applyReportCriteria(list, params) {
  const reportId = params.get('report');
  const criteria = CUSTOMER_REPORT_CRITERIA[reportId];
  if (!criteria) {
    return list;
  }
  return list.filter((record) => matchesReportCriteria(record, criteria));
}

function matchesReportCriteria(record, criteria) {
  if (criteria.anyOf && !criteria.anyOf.some((key) => isReportFieldSet(record, key))) {
    return false;
  }
  if (criteria.allOf && !criteria.allOf.every((key) => isReportFieldSet(record, key))) {
    return false;
  }
  if (criteria.noneOf && criteria.noneOf.some((key) => isReportFieldSet(record, key))) {
    return false;
  }
  return true;
}

function applySearch(list, rawSearch) {
  const term = (rawSearch ?? '').trim().toLowerCase();
  if (!term) {
    return list;
  }
  const index = searchIndexFor(list);
  return list.filter((_, i) => index[i].includes(term));
}

/**
 * Precomputed lowercase concatenation of every searchable field per record.
 * Built once per dataset; `applySearch` then costs one `includes()` per
 * record (~14k string scans, single-digit ms) instead of 23 per record.
 */
function searchIndexFor(records) {
  let index = searchIndexCache.get(records);
  if (index) {
    return index;
  }
  index = records.map((record) =>
    SEARCH_FIELDS.map((field) => String(record[field] ?? '').toLowerCase()).join('\u0000'),
  );
  searchIndexCache.set(records, index);
  return index;
}

function applyCategoricalFilters(list, params) {
  for (const [param, field] of Object.entries(CATEGORICAL_FILTER_FIELDS)) {
    const raw = params.get(param);
    if (raw === null || raw === '') {
      continue;
    }
    const id = Number(raw);
    if (!Number.isFinite(id)) {
      continue;
    }
    list = list.filter((record) => Number(record[field]) === id);
  }
  return list;
}

function applyTextFilters(list, params) {
  const textFilters = parseJsonParam(params.get('textFilters'), {});
  const operators = parseJsonParam(params.get('textOperators'), {});

  for (const key of Object.keys(textFilters)) {
    const value = String(textFilters[key] ?? '').trim();
    if (!value) {
      continue;
    }
    const fields = TEXT_FILTER_FIELDS[key];
    if (!fields) {
      continue;
    }
    const operator = String(operators[key] ?? 'contains');
    if (key === 'id') {
      list = list.filter((record) => matchesNumeric(record, fields, value, operator));
    } else {
      list = list.filter((record) => matchesText(record, fields, value, operator));
    }
  }
  return list;
}

function matchesText(record, fields, needle, operator) {
  const value = firstValue(record, fields);
  if (value === null) {
    return false;
  }
  const haystack = String(value).toLowerCase();
  const target = needle.toLowerCase();
  switch (operator) {
    case 'equals':
      return haystack === target;
    case 'startsWith':
      return haystack.startsWith(target);
    case 'endsWith':
      return haystack.endsWith(target);
    case 'contains':
    default:
      return haystack.includes(target);
  }
}

function matchesNumeric(record, fields, rawNeedle, operator) {
  const needle = Number(rawNeedle);
  if (!Number.isFinite(needle)) {
    return true;
  }
  const value = Number(firstValue(record, fields));
  if (!Number.isFinite(value)) {
    return false;
  }
  switch (operator) {
    case 'greaterThan':
      return value > needle;
    case 'greaterThanOrEqual':
      return value >= needle;
    case 'lessThan':
      return value < needle;
    case 'lessThanOrEqual':
      return value <= needle;
    case 'equals':
      return value === needle;
    default:
      return String(value).includes(String(needle));
  }
}

/**
 * Sorts by precomputed natural-sort keys. Keys are prepared once per
 * (dataset, field) and reused by every request, so a 14,111-record sort costs
 * a single comparison pass instead of repeatedly paying ICU collation.
 *
 * Key rules (mirrors the legacy numeric/empty handling):
 *   - null / undefined / empty      → sorts last
 *   - numbers and numeric strings   → numeric key
 *   - everything else               → lowercase token array (digit chunks as
 *                                     numbers, text chunks as strings), so
 *                                     "Customer 2" < "Customer 10" naturally
 */
function sortByField(list, field, direction) {
  const keys = sortKeysFor(list, field);
  const decorated = list.map((record, index) => ({ record, index, key: keys[index] }));
  decorated.sort((a, b) => {
    let comparison = compareKeys(a.key, b.key);
    if (comparison === 0) {
      comparison = Number(a.record.Id) - Number(b.record.Id);
    }
    return comparison * direction;
  });
  return decorated.map((item) => item.record);
}

function sortKeysFor(records, field) {
  let byField = sortKeyCache.get(records);
  if (!byField) {
    byField = new Map();
    sortKeyCache.set(records, byField);
  }
  let keys = byField.get(field);
  if (!keys) {
    keys = records.map((record) => prepareSortKey(record[field]));
    byField.set(field, keys);
  }
  return keys;
}

function prepareSortKey(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  const text = String(raw).trim();
  if (text === '') {
    return null;
  }
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return naturalTokens(text.toLowerCase());
}

function naturalTokens(text) {
  const tokens = [];
  let i = 0;
  const length = text.length;
  while (i < length) {
    const digit = isDigitCode(text.charCodeAt(i));
    let j = i;
    while (j < length && isDigitCode(text.charCodeAt(j)) === digit) {
      j += 1;
    }
    const chunk = text.slice(i, j);
    tokens.push(digit ? Number(chunk) : chunk);
    i = j;
  }
  return tokens;
}

function isDigitCode(code) {
  return code >= 48 && code <= 57;
}

function compareKeys(left, right) {
  if (left === null) {
    return right === null ? 0 : -1;
  }
  if (right === null) {
    return 1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'number') {
    return -1;
  }
  if (typeof right === 'number') {
    return 1;
  }
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a === undefined) {
      return -1;
    }
    if (b === undefined) {
      return 1;
    }
    if (typeof a === 'number' && typeof b === 'number') {
      if (a !== b) {
        return a - b;
      }
      continue;
    }
    if (a !== b) {
      return a < b ? -1 : 1;
    }
  }
  return 0;
}

function distinctOptions(records, idField, labelFields) {
  const seen = new Map();
  for (const record of records) {
    const id = Number(record[idField]);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      continue;
    }
    const label = firstValue(record, labelFields);
    seen.set(id, label === null ? String(id) : String(label));
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function parseJsonParam(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
}

function clampInt(raw, fallback, min, max) {
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}