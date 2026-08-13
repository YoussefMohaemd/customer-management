import type { Environment } from './environment.types';

export const environment: Environment = {
  production: false,
  api: {
    baseUrl: 'https://testmobapi.erppluscloud.com',
    crmPath: '/api/CRM',
    endpoints: {
      readAllCrmClients: '/api/CRM/ReadAllCRMClients',
      saveCustomerWithContactPerson: '/api/CRM/SaveCustomerWithContactPerson',
    },
    direction: 'ltr',
  },
  customers: {
    defaultPageSize: 5,
    pageSizeOptions: [5, 10, 20, 30],
    searchDebounceMs: 400,
    maxRecordsToLoad: 50000,
    cacheTtlMs: 300_000,
    serverPagination: false,
  },
};
