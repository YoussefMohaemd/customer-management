export interface Environment {
  production: boolean;
  api: {
    baseUrl: string;
    crmPath: string;
    endpoints: {
      readAllCrmClients: string;
      saveCustomerWithContactPerson: string;
    };
    direction: string;
  };
  customers: {
    defaultPageSize: number;
    pageSizeOptions: number[];
    searchDebounceMs: number;
    maxRecordsToLoad: number;
    /**
     * How long the in-memory cache of a legacy-API search result stays
     * fresh (milliseconds). While fresh, pagination/sorting/filtering and
     * re-visits of the page are served instantly from the cache. The
     * Refresh button and successful Saves always bust the cache.
     */
    cacheTtlMs: number;
    /**
     * Whether the Read API supports true server-side pagination, sorting and
     * categorical filtering. The current staging API does NOT (verified from
     * the Postman collection: only `Text`, `Direction`, `InCT`), so this
     * stays `false` and the store derives the page over the loaded set.
     * Set to `true` once the backend implements the proposed contract in
     * the README — the service then sends the full paged query and the
     * store renders exactly the returned page with the server `Total`.
     */
    serverPagination: boolean;
  };
}
