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
  };
}
