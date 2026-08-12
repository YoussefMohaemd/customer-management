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
  composeServerSearchText,
} from '@features/customers/models/customer-query.model';
import {
  SaveCustomerResult,
  normalizeSaveCustomerResult,
} from '@features/customers/models/customer-response.model';

/**
 * Encapsulates every HTTP interaction with the CRM API.
 *
 * Verified staging contract (see README → "Known API Limitations"):
 *  - `ReadAllCRMClients` returns `{ "Data": Client[], "Total": number }`
 *    — the full matching collection. `Page`/`PageSize`/`Skip`/`Take`
 *    parameters are ignored by the server, so pagination is derived from the
 *    loaded matching set (only the current page is ever rendered).
 *  - the only server filter is the free-text `Text` parameter, therefore the
 *    debounced search box and free-text filters are combined into it.
 *  - `SaveCustomerWithContactPerson` is an upsert keyed by `Id` (0 = create).
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  private readonly readEndpoint = `${environment.api.baseUrl}${environment.api.endpoints.readAllCrmClients}`;
  private readonly saveEndpoint = `${environment.api.baseUrl}${environment.api.endpoints.saveCustomerWithContactPerson}`;

  /** Reads the current matching customer set from the CRM API. */
  fetchCustomers(query: CustomerQuery): Observable<CustomerListResult> {
    const text = composeServerSearchText(query.search, query.textFilters);
    const params = new HttpParams()
      .set('Text', text)
      .set('Direction', environment.api.direction)
      .set('InCT', '');

    return this.http.get(this.readEndpoint, { params }).pipe(map(normalizeCustomerList));
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