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
    defaultPageSize: 8,
    pageSizeOptions: [5, 8, 10, 20, 50],
    searchDebounceMs: 400,
    maxRecordsToLoad: 50000,
  },
};
