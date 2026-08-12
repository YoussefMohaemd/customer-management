import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, EMPTY, finalize, map, of, tap, throwError } from 'rxjs';

import { environment } from '@environments/environment';
import {
  CustomerPayload,
  CustomerRecord,
  createCustomerPayloadDefaults
} from '@features/customers/models/customer.model';
import {
  CustomerFilters,
  CustomerFilterKey,
  CustomerQuery,
  CustomerSortField,
  CustomerTextFilterKey,
  EMPTY_CUSTOMER_FILTERS,
  SortDirection,
  hasActiveCategoricalFilters,
  hasAnyFilter,
  isCustomerQueryEqual
} from '@features/customers/models/customer-query.model';
import { SaveCustomerResult } from '@features/customers/models/customer-response.model';
import { CustomerService } from '@features/customers/services/customer.service';

export type CustomerFormMode = 'create' | 'edit' | 'view';

/**
 * Signal-based customer store.
 *
 * The staging Read API has no server-side pagination/sorting parameters, so
 * the store loads the matching set (server-filtered via the `Text` parameter)
 * and derives pagination/sorting in memory. Only the current page is rendered.
 * See README → "Known API Limitations" for the exact contract facts.
 *
 * Async operations (search, save) are exposed as Observables; UI state is
 * always consumed through signals/computed().
 */
@Injectable({ providedIn: 'root' })
export class CustomerStore {
  private readonly customerService = inject(CustomerService);

  // --- Server-driven state -------------------------------------------------
  readonly records = signal<CustomerRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadWarning = signal<string | null>(null);

  // --- Save (create/edit) state --------------------------------------------
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  // --- Query state ----------------------------------------------------------
  readonly searchTerm = signal('');
  readonly textFilters = signal<Partial<Record<CustomerTextFilterKey, string>>>({});
  readonly filters = signal<CustomerFilters>({ ...EMPTY_CUSTOMER_FILTERS });
  readonly page = signal(1);
  readonly pageSize = signal(environment.customers.defaultPageSize);
  readonly sortField = signal<CustomerSortField | null>(null);
  readonly sortDirection = signal<SortDirection>('asc');

  // --- UI state -------------------------------------------------------------
  readonly selectedCustomer = signal<CustomerRecord | null>(null);
  readonly formOpen = signal(false);
  readonly formMode = signal<CustomerFormMode>('edit');
  readonly formCustomer = signal<CustomerRecord | null>(null);

  private lastExecutedQuery: CustomerQuery | null = null;

  // --- Derived state --------------------------------------------------------
  readonly totalRecords = computed(() => this.records().length);

  readonly categoricalFilteredRecords = computed<CustomerRecord[]>(() => {
    const filters = this.filters();
    if (!hasActiveCategoricalFilters(filters)) {
      return this.records();
    }
    return this.records().filter((record) => {
      if (filters.clientTypeId !== null && record.accountTypeId !== filters.clientTypeId) {
        return false;
      }
      if (filters.accountManagerId !== null && record.accountManagerId !== filters.accountManagerId) {
        return false;
      }
      if (filters.cityId !== null && record.cityId !== filters.cityId) {
        return false;
      }
      if (filters.countryId !== null && record.countryId !== filters.countryId) {
        return false;
      }
      return true;
    });
  });

  readonly sortedRecords = computed<CustomerRecord[]>(() => {
    const field = this.sortField();
    const direction = this.sortDirection();
    if (!field) {
      return this.categoricalFilteredRecords();
    }
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...this.categoricalFilteredRecords()].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      const comparison = String(aValue ?? '').localeCompare(String(bValue ?? ''), undefined, { sensitivity: 'base' });
      return comparison === 0 ? a.id - b.id : comparison * multiplier;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sortedRecords().length / this.pageSize())));
  readonly paginatedCustomers = computed<CustomerRecord[]>(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedRecords().slice(start, start + this.pageSize());
  });

  readonly pageStartIndex = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly pageEndIndex = computed(() => {
    const end = this.page() * this.pageSize();
    return Math.min(end, this.sortedRecords().length);
  });
  readonly hasRecords = computed(() => this.records().length > 0);
  readonly isEmptyResult = computed(() => !this.loading() && !this.error() && this.records().length === 0);
  readonly hasServerSearch = computed(() => this.searchTerm().trim().length > 0);
  readonly hasFilters = computed(() => hasAnyFilter(this.currentQuery()));
  readonly totalFilterCount = computed(() => {
    let count = 0;
    for (const value of Object.values(this.textFilters())) {
      if ((value ?? '').trim()) {
        count += 1;
      }
    }
    for (const value of Object.values(this.filters())) {
      if (value !== null) {
        count += 1;
      }
    }
    return count;
  });

  // --- Lookup options for categorical filters (derived from real data) ------
  readonly clientTypeOptions = computed(() =>
    distinctBy(this.records(), (r) => r.accountTypeId).map((r) => ({ value: r.accountTypeId, label: `Client Type ${r.accountTypeId}` }))
  );
  readonly accountManagerOptions = computed(() =>
    distinctBy(this.records(), (r) => r.accountManagerId).map((r) => ({ value: r.accountManagerId, label: `Account Manager ${r.accountManagerId}` }))
  );
  readonly cityOptions = computed(() => distinctBy(this.records(), (r) => r.cityId).map((r) => ({ value: r.cityId, label: r.city || `City ${r.cityId}` })));
  readonly countryOptions = computed(() => distinctBy(this.records(), (r) => r.countryId).map((r) => ({ value: r.countryId, label: r.country || `Country ${r.countryId}` })));

  // --- Query assembly -------------------------------------------------------
  private currentQuery(): CustomerQuery {
    return {
      search: this.searchTerm(),
      textFilters: this.textFilters(),
      filters: this.filters(),
      page: this.page(),
      pageSize: this.pageSize(),
      sortField: this.sortField(),
      sortDirection: this.sortDirection()
    };
  }

  /**
   * Fetches the matching customer set. Returns an Observable so callers can
   * orchestrate it with RxJS (e.g. switchMap for debounced search) and so
   * stale requests are cancelled. Repeated identical queries are de-duplicated.
   */
  loadCustomers(): Observable<CustomerRecord[]> {
    const query = this.currentQuery();

    if (this.loading()) {
      return EMPTY;
    }
    if (this.lastExecutedQuery && isCustomerQueryEqual(this.lastExecutedQuery, query)) {
      return of(this.records());
    }

    this.lastExecutedQuery = query;
    this.loading.set(true);
    this.error.set(null);
    this.loadWarning.set(null);

    return this.customerService.fetchCustomers(query).pipe(
      tap((records) => {
        this.records.set(records);
        if (records.length > environment.customers.maxRecordsToLoad) {
          this.loadWarning.set(
            `The server returned ${records.length.toLocaleString()} matching records. ` +
              `For safety this app caps the loaded set at ${environment.customers.maxRecordsToLoad.toLocaleString()} — ` +
              `narrow your search to work with a smaller set.`
          );
          this.records.set(records.slice(0, environment.customers.maxRecordsToLoad));
        }
      }),
      catchError((error: unknown) => {
        this.lastExecutedQuery = null;
        this.error.set(messageFrom(error));
        return throwError(() => error);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  /** Debounced server-side search — invoked from the page via switchMap. */
  searchCustomers(term: string): Observable<CustomerRecord[]> {
    if (term === this.searchTerm()) {
      return of(this.records());
    }
    this.searchTerm.set(term.trim());
    this.page.set(1);
    return this.loadCustomers();
  }

  /** Clears the search box and reloads the full set. */
  clearSearch(): Observable<CustomerRecord[]> {
    if (this.searchTerm() === '' && this.resultsAlreadyLoaded) {
      return EMPTY;
    }
    return this.searchCustomers('');
  }

  private get resultsAlreadyLoaded(): boolean {
    return this.lastExecutedQuery !== null && this.lastExecutedQuery.search === '';
  }

  setPage(page: number): void {
    const bounded = Math.min(Math.max(page, 1), this.totalPages());
    this.page.set(bounded);
  }

  setPageSize(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.setPage(1);
  }

  setSort(field: CustomerSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.page.set(1);
  }

  // --- Text filters (server-side via the `Text` parameter) ------------------
  setTextFilter(key: CustomerTextFilterKey, value: string): void {
    const current = { ...this.textFilters() };
    if ((value ?? '').trim()) {
      current[key] = value.trim();
    } else {
      delete current[key];
    }
    this.textFilters.set(current);
    this.page.set(1);
  }

  clearTextFilters(): void {
    this.textFilters.set({});
    this.page.set(1);
  }

  // --- Categorical filters (over the loaded set — API limitation) -----------
  setCategoricalFilter(key: CustomerFilterKey, value: number | null): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    this.page.set(1);
  }

  clearCategoricalFilters(): void {
    this.filters.set({ ...EMPTY_CUSTOMER_FILTERS });
    this.page.set(1);
  }

  clearAllFilters(): void {
    this.clearTextFilters();
    this.clearCategoricalFilters();
  }

  // --- Form dialog ----------------------------------------------------------
  openCreateForm(): void {
    this.formCustomer.set(null);
    this.formMode.set('create');
    this.formOpen.set(true);
    this.saveError.set(null);
  }

  openEditForm(customer: CustomerRecord): void {
    this.selectedCustomer.set(customer);
    this.formCustomer.set(customer);
    this.formMode.set('edit');
    this.formOpen.set(true);
    this.saveError.set(null);
  }

  openViewForm(customer: CustomerRecord): void {
    this.selectedCustomer.set(customer);
    this.formCustomer.set(customer);
    this.formMode.set('view');
    this.formOpen.set(true);
    this.saveError.set(null);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formCustomer.set(null);
    this.selectedCustomer.set(null);
    this.saveError.set(null);
    this.saving.set(false);
  }

  /**
   * Runs the SaveCustomerWithContactPerson call. Disables duplicate submits
   * via the `saving` signal. On success the list is refreshed.
   */
  saveCustomer(payload: CustomerPayload): Observable<SaveCustomerResult> {
    if (this.saving()) {
      return EMPTY;
    }
    this.saving.set(true);
    this.saveError.set(null);

    return this.customerService.saveCustomer(payload).pipe(
      finalize(() => this.saving.set(false)),
      catchError((error: unknown) => {
        this.saveError.set(messageFrom(error));
        return throwError(() => error);
      }),
      // Refresh the list so the new/updated record shows up immediately.
      map((result) => {
        if (result.success) {
          this.lastExecutedQuery = null;
          void this.loadCustomers().subscribe({
            error: () => undefined
          });
        }
        return result;
      })
    );
  }

  /** Factory for the form payload with sane defaults. */
  createPayload(): CustomerPayload {
    return createCustomerPayloadDefaults();
  }
}

function distinctBy<T>(items: T[], key: (item: T) => number | null): T[] {
  const seen = new Set<number>();
  const result: T[] = [];
  for (const item of items) {
    const value = key(item);
    if (value === null || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(item);
  }
  return result;
}

function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}