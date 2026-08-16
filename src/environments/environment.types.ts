export interface Environment {
  production: boolean;
  api: {
    /**
     * Base URL of the Backend-for-Frontend (BFF). Empty string = same origin:
     * the Angular dev-server proxy routes `/api/customers` to the BFF (see
     * `proxy.conf.json`). In production, set this to the deployed BFF origin
     * when the app and the BFF are hosted separately.
     */
    bffBaseUrl: string;
    /** BFF routes (see `server/src/server.js`). */
    bff: {
      customers: string;
      saveCustomer: string;
      exportCustomers: string;
      lookups: string;
      health: string;
    };
  };
  customers: {
    defaultPageSize: number;
    pageSizeOptions: number[];
    searchDebounceMs: number;
  };
}