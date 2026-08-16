import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@environments/environment';
import {
  CustomerListResult,
  CustomerPayload,
  CustomerRecord,
  normalizeCustomerList,
} from '@features/customers/models/customer.model';
import {
  CustomerLookups,
  CustomerQuery,
  CustomerSortField,
  CustomerTextFilterKey,
  SortDirection,
} from '@features/customers/models/customer-query.model';
import {
  SaveCustomerResult,
  normalizeSaveCustomerResult,
} from '@features/customers/models/customer-response.model';

/**
 * Encapsulates every HTTP interaction with the Customer BFF.
 *
 * Architecture: Angular NEVER talks to the unparameterized CRM dump endpoint
 * (`ReadAllCRMClients`) for table data. The CRM API ignores every query
 * parameter — `Text`, `Direction`, `InCT`, `Page`, `PageSize`, `Skip`, `Take`,
 * `offset`, `limit` (verified live: all return the byte-identical ~14,111-
 * record / ~15 MB dump) — so the BFF (`server/`) fetches the dataset once,
 * caches it server-side and serves real server-side pagination, search,
 * filtering and sorting. See `server/README.md`.
 *
 * Request contract (BFF):
 *   GET {bff}/customers?page=&pageSize=&search=&sortField=&sortDirection=
 *       &clientTypeId=&accountManagerId=&cityId=&countryId=
 *       &textFilters={json}&textOperators={json}&report={reportId}
 *   → { "data": Customer[], "totalCount": number }  (data = ONLY current page)
 *
 *   `report` (optional) names the active Reports-section card; the BFF applies
 *   that report's server-side criteria before search/filter/sort/pagination.
 *
 *   GET {bff}/customers/lookups   → { clientTypes, accountManagers, cities, countries }
 *   GET {bff}/customers/export    → { data: [...all matching], totalCount }
 *   POST {bff}/customers/save     → forwards SaveCustomerWithContactPerson
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  private readonly customersEndpoint = `${environment.api.bffBaseUrl}${environment.api.bff.customers}`;
  private readonly saveEndpoint = `${environment.api.bffBaseUrl}${environment.api.bff.saveCustomer}`;
  private readonly exportEndpoint = `${environment.api.bffBaseUrl}${environment.api.bff.exportCustomers}`;
  private readonly lookupsEndpoint = `${environment.api.bffBaseUrl}${environment.api.bff.lookups}`;

  /** Reads ONLY the requested page of customers from the BFF. */
  fetchCustomers(query: CustomerQuery): Observable<CustomerListResult> {
    return this.http
      .get(this.customersEndpoint, { params: buildCustomerQueryParams(query) })
      .pipe(map(normalizeCustomerList));
  }

  /** Fetches the full matching set (search + filters + sort, no pagination)
   *  for Excel export. */
  fetchCustomersForExport(query: CustomerQuery): Observable<CustomerRecord[]> {
    return this.http
      .get(this.exportEndpoint, { params: buildCustomerQueryParams(query, false) })
      .pipe(map((raw) => normalizeCustomerList(raw).records));
  }

  /** Distinct dropdown options for the categorical filters (BFF lookups). */
  fetchLookups(): Observable<CustomerLookups> {
    return this.http.get(this.lookupsEndpoint).pipe(map(normalizeCustomerLookups));
  }

  /** Creates (Id = 0) or updates (existing Id) a customer through the BFF,
   *  which proxies `SaveCustomerWithContactPerson` and refreshes its cache. */
  saveCustomer(payload: CustomerPayload): Observable<SaveCustomerResult> {
    return this.http.post(this.saveEndpoint, payload).pipe(map(normalizeSaveCustomerResult));
  }
}

/**
 * Maps the canonical frontend sort field to the API/DB field name used by
 * the BFF's sort contract. Field names follow the API's own payload
 * conventions (`AccountManagerName`, `AccountTypeName`, `CommercialName`,
 * `CityName`, `CountryName`, …) so the backend never receives invented
 * frontend-only names such as `accountManager` or `clientType`.
 */
const SORT_FIELD_MAP: Record<CustomerSortField, string> = {
  id: 'Id',
  code: 'Code',
  commercialName: 'CommercialName',
  nameEn: 'NameEN',
  nameAr: 'NameAR',
  clientType: 'ClientType',
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
  gender: 'Gender',
  status: 'Status',
  birthDate: 'BirthDate',
  registrationDate: 'RegistrationDate',
  createdDate: 'CreatedDate',
  address: 'Address',
  comment: 'Comment',
  taxFileNumber: 'TaxFileNumber',
  commercialRegistrationNumber: 'CommercialRegistrationNumber',
  vatRegistrationNumber: 'VATRegistrationNumber',
};

/**
 * Builds the BFF query string for the customer table.
 *
 * The request carries the COMPLETE table state — page, pageSize, search,
 * sort, categorical filter ids and per-field text filters/operators — so one
 * real table-state change produces exactly one request and the BFF returns
 * only the requested page.
 */
export function buildCustomerQueryParams(query: CustomerQuery, paginate = true): HttpParams {
  let params = new HttpParams();

  if (paginate) {
    params = params.set('page', query.page.toString()).set('pageSize', query.pageSize.toString());
  }

  const search = query.search.trim();
  if (search) {
    params = params.set('search', search);
  }

  if (query.sortField) {
    params = params
      .set('sortField', SORT_FIELD_MAP[query.sortField])
      .set('sortDirection', query.sortDirection);
  }

  if (query.report) {
    params = params.set('report', query.report);
  }

  if (query.filters.clientTypeId !== null) {
    params = params.set('clientTypeId', query.filters.clientTypeId.toString());
  }
  if (query.filters.accountManagerId !== null) {
    params = params.set('accountManagerId', query.filters.accountManagerId.toString());
  }
  if (query.filters.cityId !== null) {
    params = params.set('cityId', query.filters.cityId.toString());
  }
  if (query.filters.countryId !== null) {
    params = params.set('countryId', query.filters.countryId.toString());
  }

  const activeTextFilters = collectActiveTextFilters(query);
  if (Object.keys(activeTextFilters.filters).length > 0) {
    params = params.set('textFilters', JSON.stringify(activeTextFilters.filters));
  }
  if (Object.keys(activeTextFilters.operators).length > 0) {
    params = params.set('textOperators', JSON.stringify(activeTextFilters.operators));
  }

  return params;
}

/** Keeps only non-empty text filter values and their operators. */
function collectActiveTextFilters(query: CustomerQuery): {
  filters: Record<string, string>;
  operators: Record<string, string>;
} {
  const filters: Record<string, string> = {};
  const operators: Record<string, string> = {};
  for (const [key, value] of Object.entries(query.textFilters)) {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      continue;
    }
    filters[key] = trimmed;
    const operator = query.textFilterOperators[key as CustomerTextFilterKey];
    if (operator) {
      operators[key] = operator;
    }
  }
  return { filters, operators };
}

/** Guards the BFF lookups payload into a typed shape. */
function normalizeCustomerLookups(raw: unknown): CustomerLookups {
  if (typeof raw !== 'object' || raw === null) {
    return { clientTypes: [], accountManagers: [], cities: [], countries: [] };
  }
  const record = raw as Record<string, unknown>;
  return {
    clientTypes: readOptions(record['clientTypes']),
    accountManagers: readOptions(record['accountManagers']),
    cities: readOptions(record['cities']),
    countries: readOptions(record['countries']),
  };
}

function readOptions(raw: unknown): { value: number; label: string }[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      value: Number(item['value']),
      label: String(item['label'] ?? ''),
    }))
    .filter((option) => Number.isFinite(option.value));
}
