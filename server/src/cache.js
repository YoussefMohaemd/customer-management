import { config } from './config.js';
import { fetchCustomerDataset } from './upstream.js';

/**
 * Server-side dataset cache with stale-while-revalidate semantics.
 *
 * The upstream CRM API cannot paginate (it always returns the full ~14,000-
 * record dump), so this BFF fetches the dataset ONCE and serves every table
 * interaction from memory:
 *
 *   fresh (age < freshMs)          → serve immediately, zero upstream traffic
 *   stale (age < maxStaleMs)       → serve immediately + refresh in background
 *   cold / hard-stale              → block on a single-flight refresh
 *   refresh fails with stale data  → keep serving stale + retry in background
 *
 * Concurrent table requests never trigger concurrent upstream downloads: the
 * refresh promise is shared (single-flight). A successful Save marks the cache
 * stale and starts a background refresh so the next page render stays fast.
 */
const state = {
  records: null,
  total: 0,
  fetchedAt: 0,
  fetchMs: 0,
  fetchCount: 0,
  lastError: null,
  refreshing: null,
};

export function getDataset() {
  const age = state.records ? Date.now() - state.fetchedAt : Infinity;

  if (state.records && age < config.cache.freshMs) {
    return Promise.resolve(state.records);
  }

  if (state.records && age < config.cache.maxStaleMs) {
    refreshInBackground();
    return Promise.resolve(state.records);
  }

  return refresh().catch((error) => {
    if (state.records) {
      // Upstream is down but we still have data: serve it and retry async.
      state.lastError = error;
      refreshInBackground();
      return state.records;
    }
    throw error;
  });
}

/** Returns cached records only — never touches the upstream API. */
export function getCachedOrNull() {
  return state.records;
}

/**
 * Marks the cache stale and starts a background refresh. Used after a
 * successful Save: the very next table request still answers instantly from
 * memory while the new dataset arrives in the background.
 */
export function invalidate() {
  if (!state.records) {
    refreshInBackground();
    return;
  }
  const age = Date.now() - state.fetchedAt;
  if (age >= config.cache.freshMs) {
    refreshInBackground();
    return;
  }
  // Simulate "stale" so the next read serves immediately + refreshes async.
  state.fetchedAt = Date.now() - config.cache.freshMs - 1;
  refreshInBackground();
}

export function cacheStatus() {
  return {
    warm: state.records !== null,
    records: state.records ? state.records.length : 0,
    total: state.total,
    fetchedAt: state.records ? new Date(state.fetchedAt).toISOString() : null,
    ageMs: state.records ? Date.now() - state.fetchedAt : null,
    lastFetchMs: state.fetchMs,
    fetchCount: state.fetchCount,
    refreshing: state.refreshing !== null,
    lastError: state.lastError ? String(state.lastError.message ?? state.lastError) : null,
  };
}

function refreshInBackground() {
  if (state.refreshing) {
    return state.refreshing;
  }
  const promise = refresh().catch(() => {
    // Background refresh failures are swallowed: the stale dataset stays
    // servable and the next stale-read schedules another attempt.
  });
  return promise;
}

function refresh() {
  if (state.refreshing) {
    return state.refreshing;
  }
  const started = Date.now();
  const promise = fetchCustomerDataset()
    .then((result) => {
      state.records = result.records;
      state.total = result.total;
      state.fetchedAt = Date.now();
      state.fetchMs = result.upstreamFetchMs;
      state.fetchCount += 1;
      state.lastError = null;
      return state.records;
    })
    .finally(() => {
      if (state.refreshing === promise) {
        state.refreshing = null;
      }
    });
  state.refreshing = promise;
  return promise;
}