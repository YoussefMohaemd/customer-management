import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@environments/environment';
import {
  CustomerPayload,
  CustomerRecord,
  normalizeCustomerList
} from '@features/customers/models/customer.model';
import {
  CustomerQuery,
  composeServerSearchText
} from '@features/customers/models/customer-query.model';
import {
  SaveCustomerResult,
  normalizeSaveCustomerResult
} from '@features/customers/models/customer-response.model';

/**
 * Encapsulates every HTTP interaction with the CRM API.
 *
 * The staging Read endpoint does NOT expose server-side pagination, sorting
 * or per-field filtering parameters — only a free-text `Text` parameter.
 * Therefore:
 *  - search is executed server-side via `Text` (debounced, see store),
 *  - any remaining categorical filters, sorting and pagination are applied
 *    over the loaded matching set (see customer.store / README).
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  private readonly readEndpoint = `${environment.api.baseUrl}${environment.api.endpoints.readAllCrmClients}`;
  private readonly saveEndpoint = `${environment.api.baseUrl}${environment.api.endpoints.saveCustomerWithContactPerson}`;

  /** Reads the current matching customer set from the CRM API. */
  fetchCustomers(query: CustomerQuery): Observable<CustomerRecord[]> {
    const text = composeServerSearchText(query.search, query.textFilters);
    const params = new HttpParams()
      .set('Text', text)
      .set('Direction', environment.api.direction)
      .set('InCT', '');

    return this.http.get(this.readEndpoint, { params }).pipe(map(normalizeCustomerList));
  }

  /** Creates or updates a customer through SaveCustomerWithContactPerson. */
  saveCustomer(payload: CustomerPayload): Observable<SaveCustomerResult> {
    const params = new HttpParams().set('InCT', '');
    return this.http
      .post(this.saveEndpoint, payload, { params })
      .pipe(map(normalizeSaveCustomerResult));
  }
}