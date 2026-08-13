import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@environments/environment';
import {
  CustomerListResult,
  CustomerPayload,
  normalizeCustomerList,
} from '@features/customers/models/customer.model';
import {
  CustomerQuery,
  CustomerSortField,
  SortDirection,
} from '@features/customers/models/customer-query.model';
import {
  SaveCustomerResult,
  normalizeSaveCustomerResult,
} from '@features/customers/models/customer-response.model';

/**
 * Encapsulates every HTTP interaction with the CRM API.
 *
 * Request contract (source of truth: the provided Postman collection):
 *  - `ReadAllCRMClients` is `GET .../ReadAllCRMClients?Text=&Direction=ltr&InCT=`.
 *    The collection documents exactly three query parameters — `Text`,
 *    `Direction`, `InCT`. There are NO pagination, sorting or categorical
 *    filter parameters, and the API returns the FULL matching collection as
 *    `{ "Data": Client[], "Total": number }` (verified live), where `Total`
 *    is the count of the full matching set.
 *  - Because the API has no pagination contract, the request carries only
 *    the documented parameters. The store renders the current page from the
 *    returned set (capped; see README → "Known API Limitations").
 *  - When `environment.customers.serverPagination` is enabled, the service
 *    additionally sends the proposed paged contract (`Page`, `PageSize`,
 *    `SortField`, `SortDirection`, `ClientTypeId`, `AccountManagerId`,
 *    `CityId`, `CountryId`) and the store switches to true server-side
 *    pagination with the server-provided `Total`. The flag is `false` until
 *    the backend implements that contract — see README → "Proposed Backend
 *    Contract".
 *  - `Text` receives only the search-box term (plain substring). Per-field
 *    text filters are applied client-side over the returned set.
 *  - `SaveCustomerWithContactPerson` is an upsert keyed by `Id` (0 = create).
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  private readonly readEndpoint = `${environment.api.baseUrl}${environment.api.endpoints.readAllCrmClients}`;
  private readonly saveEndpoint = `${environment.api.baseUrl}${environment.api.endpoints.saveCustomerWithContactPerson}`;

  /** Reads the current matching customers from the CRM API. */
  fetchCustomers(query: CustomerQuery): Observable<CustomerListResult> {
    return this.http
      .get(this.readEndpoint, { params: buildCustomerQueryParams(query) })
      .pipe(map(normalizeCustomerList));
  }

  /** Creates (Id = 0) or updates (existing Id) a customer through
   *  SaveCustomerWithContactPerson. */
  saveCustomer(payload: CustomerPayload): Observable<SaveCustomerResult> {
    const params = new HttpParams().set('InCT', '');
    return this.http
      .post(this.saveEndpoint, payload, { params })
      .pipe(map(normalizeSaveCustomerResult));
  }
}

/**
 * Maps the canonical frontend sort field to the API/DB field name used by
 * the proposed server-side sort contract. Field names follow the API's own
 * payload conventions (`AccountManagerName`, `AccountTypeName`,
 * `CommercialName`, `CityName`, `CountryName`, …) so the backend never
 * receives invented frontend-only names such as `accountManager` or
 * `clientType`.
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
 * Builds the query string for `ReadAllCRMClients`.
 *
 * Legacy mode (current API — the default): the request contains exactly the
 * three parameters documented in the Postman collection. No pagination,
 * sorting or categorical filter parameters are sent because the API does not
 * support them; inventing them would not change the server response.
 *
 * Server-pagination mode (`environment.customers.serverPagination = true`):
 * the same query object additionally carries the proposed paged contract —
 * `Page`/`PageSize` (offset derived as `(page - 1) * pageSize`),
 * `SortField`/`SortDirection` (canonical API field names) and the categorical
 * filter ids — and `{ "Data": [...], "Total": number }` is expected to carry
 * only the requested page with the total count of the matching set.
 */
export function buildCustomerQueryParams(query: CustomerQuery): HttpParams {
  let params = new HttpParams()
    .set('Text', query.search.trim())
    .set('Direction', environment.api.direction)
    .set('InCT', '');

  if (environment.customers.serverPagination) {
    params = params.set('Page', query.page.toString()).set('PageSize', query.pageSize.toString());

    if (query.sortField) {
      params = params
        .set('SortField', SORT_FIELD_MAP[query.sortField])
        .set('SortDirection', sortDirectionValue(query.sortDirection));
    }
    if (query.filters.clientTypeId !== null) {
      params = params.set('ClientTypeId', query.filters.clientTypeId.toString());
    }
    if (query.filters.accountManagerId !== null) {
      params = params.set('AccountManagerId', query.filters.accountManagerId.toString());
    }
    if (query.filters.cityId !== null) {
      params = params.set('CityId', query.filters.cityId.toString());
    }
    if (query.filters.countryId !== null) {
      params = params.set('CountryId', query.filters.countryId.toString());
    }
  }

  return params;
}

/** Normalizes the sort direction into the API's lowercase convention. */
function sortDirectionValue(direction: SortDirection): string {
  return direction.toLowerCase();
}
