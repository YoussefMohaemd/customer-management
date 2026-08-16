import type { Environment } from './environment.types';

export const environment: Environment = {
  production: true,
  api: {
    // Same-origin by default: deploy the BFF behind the same host/domain as
    // the app and set bffBaseUrl to its origin if hosted separately.
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