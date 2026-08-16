import type { Environment } from './environment.types';

export const environment: Environment = {
  production: false,
  api: {
    // Empty → same origin: the dev-server proxy forwards /api/customers to the
    // BFF (see proxy.conf.json). Set bffBaseUrl to the deployed BFF origin in
    // production when app and BFF are hosted separately.
    bffBaseUrl: '',
    bff: {
      customers: '/api/customers',
      saveCustomer: '/api/customers/save',
      exportCustomers: '/api/customers/export',
      lookups: '/api/customers/lookups',
      health: '/api/health',
    },
  },
  customers: {
    defaultPageSize: 5,
    pageSizeOptions: [5, 10, 20],
    searchDebounceMs: 400,
  },
};