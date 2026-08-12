import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  finalize,
  map,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '@environments/environment';
import {
  CustomerListResult,
  CustomerPayload,
  CustomerRecord,
  createCustomerPayloadDefaults,
} from '@features/customers/models/customer.model';
import {
  CustomerFilters,
  CustomerFilterKey,
  CustomerFilterOperator,
  CustomerQuery,
  CustomerSortField,
  CustomerTextFilterKey,
  DEFAULT_TEXT_OPERATOR,
  EMPTY_CUSTOMER_FILTERS,
  SortDirection,
  hasActiveCategoricalFilters,
  hasActiveTextFilters,
  hasAnyFilter,
  isCustomerQueryEqual,
} from '@features/customers/models/customer-query.model';
import {
  CUSTOMER_COLUMNS,
  CustomerColumnDef,
  CustomerFieldKey,
  createDefaultHiddenColumns,
} from '@features/customers/models/customer-column.model';
import { SaveCustomerResult } from '@features/customers/models/customer-response.model';
import { CustomerService } from '@features/customers/services/customer.service';

export type CustomerFormMode = 'create' | 'edit' | 'view';

/**
 * Signal-based customer store.
 *
 * The staging Read API has no server-side pagination/sorting parameters
 * (verified: `Page`/`PageSize`/`Skip`/`Take` are ignored), so the store loads
 * the server-filtered matching set and derives pagination/sorting in memory.
 * Only the current page is rendered. See README → "Known API Limitations".
 *
 * Async orchestration (debounced search, text-filter reloads, post-save
 * refresh) lives here in one RxJS pipeline, so every state change that needs
 * a server round-trip reliably triggers one — with stale requests cancelled.
 */
@Injectable({ providedIn: 'root' })
export class CustomerStore {
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Server-driven state -------------------------------------------------
  readonly records = signal<CustomerRecord[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadWarning = signal<string | null>(null);

  // --- Save (create/edit) state --------------------------------------------
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  // --- Query state ----------------------------------------------------------
  readonly searchTerm = signal('');
  readonly textFilters = signal<Partial<Record<CustomerTextFilterKey, string>>>({});
  readonly textFilterOperators = signal<
    Partial<Record<CustomerTextFilterKey, CustomerFilterOperator>>
  >({});
  readonly filters = signal<CustomerFilters>({ ...EMPTY_CUSTOMER_FILTERS });
  readonly page = signal(1);
  readonly pageSize = signal(environment.customers.defaultPageSize);
  readonly sortField = signal<CustomerSortField | null>(null);
  readonly sortDirection = signal<SortDirection>('asc');

  // --- Column presentation state ---------------------------------------------
  readonly allColumnDefs = signal<CustomerColumnDef[]>([...CUSTOMER_COLUMNS]);
  readonly hiddenColumns = signal<ReadonlySet<CustomerFieldKey>>(createDefaultHiddenColumns());
  readonly selectedColumnDefs = computed(() =>
    this.allColumnDefs().filter((column) => !this.hiddenColumns().has(column.field)),
  );
  readonly filterableColumnDefs = computed(() =>
    this.selectedColumnDefs().filter((column) => column.filter !== undefined),
  );
  readonly visibleColumnCount = computed(() => this.selectedColumnDefs().length);

  // --- UI state -------------------------------------------------------------
  readonly selectedCustomer = signal<CustomerRecord | null>(null);
  readonly formOpen = signal(false);
  readonly formMode = signal<CustomerFormMode>('edit');
  readonly formCustomer = signal<CustomerRecord | null>(null);

  private lastExecutedQuery: CustomerQuery | null = null;

  // --- Async triggers --------------------------------------------------------
  private readonly searchSource$ = new Subject<string>();
  private readonly reloadSource$ = new Subject<void>();

  constructor() {
    this.searchSource$
      .pipe(
        debounceTime(environment.customers.searchDebounceMs),
        distinctUntilChanged(),
        switchMap((term) => this.executeSearch(term)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.reloadSource$
      .pipe(
        switchMap(() => this.executeQuery(this.currentQuery())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

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
      if (
        filters.accountManagerId !== null &&
        record.accountManagerId !== filters.accountManagerId
      ) {
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

  /**
   * Client-side operator refinement over the server-filtered set.
   *
   * The API only exposes free-text (`Text`), so the operator chosen in the
   * filter panel (contains / equals / starts with / numeric comparisons) is
   * enforced here on the loaded matching set.
   */
  readonly operatorFilteredRecords = computed<CustomerRecord[]>(() => {
    const records = this.categoricalFilteredRecords();
    const values = this.textFilters();
    if (!hasActiveTextFilters(values)) {
      return records;
    }
    const operators = this.textFilterOperators();
    return records.filter((record) =>
      TEXT_FILTER_KEYS.every((key) =>
        matchesFilterOperator(record, key, values[key], operators[key]),
      ),
    );
  });

  readonly sortedRecords = computed<CustomerRecord[]>(() => {
    const field = this.sortField();
    const direction = this.sortDirection();
    if (!field) {
      return this.operatorFilteredRecords();
    }
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...this.operatorFilteredRecords()].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      const comparison = String(aValue ?? '').localeCompare(String(bValue ?? ''), undefined, {
        sensitivity: 'base',
      });
      return comparison === 0 ? a.id - b.id : comparison * multiplier;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedRecords().length / this.pageSize())),
  );

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

  readonly isEmptyResult = computed(
    () => !this.loading() && !this.error() && this.records().length === 0,
  );

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
    distinctBy(this.records(), (r) => r.accountTypeId).map((r) => ({
      value: r.accountTypeId,
      label: r.accountTypeName || `Client Type ${r.accountTypeId}`,
    })),
  );
  readonly accountManagerOptions = computed(() =>
    distinctBy(this.records(), (r) => r.accountManagerId).map((r) => ({
      value: r.accountManagerId,
      label: r.accountManagerName || `Account Manager ${r.accountManagerId}`,
    })),
  );
  readonly cityOptions = computed(() =>
    distinctBy(this.records(), (r) => r.cityId).map((r) => ({
      value: r.cityId,
      label: r.city || `City ${r.cityId}`,
    })),
  );
  readonly countryOptions = computed(() =>
    distinctBy(this.records(), (r) => r.countryId).map((r) => ({
      value: r.countryId,
      label: r.country || `Country ${r.countryId}`,
    })),
  );

  // --- Query assembly ---------------------------------------------------------
  private currentQuery(): CustomerQuery {
    return {
      search: this.searchTerm(),
      textFilters: this.textFilters(),
      filters: this.filters(),
      page: this.page(),
      pageSize: this.pageSize(),
      sortField: this.sortField(),
      sortDirection: this.sortDirection(),
    };
  }

  // --- Server triggers --------------------------------------------------------

  /** Debounced server-side search (400 ms, stale requests cancelled). */
  search(term: string): void {
    this.searchTerm.set(term);
    this.page.set(1);
    this.searchSource$.next(term);
  }

  /** Clears the search box; reloads the full set. */
  clearSearch(): void {
    this.searchTerm.set('');
    this.page.set(1);
    this.searchSource$.next('');
  }

  /** Re-runs the current query (used for retry and after-save refresh). */
  reload(): void {
    this.reloadSource$.next();
  }

  /**
   * Hard refresh for the pagination Refresh button: always returns to
   * page 1 and re-runs the query, busting the dedupe cache so a fresh
   * request reaches the API even when the query is unchanged.
   */
  refresh(): void {
    this.page.set(1);
    this.lastExecutedQuery = null;
    this.reloadSource$.next();
  }

  // --- Pagination / sorting (client-side over the loaded set) ----------------
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

  // --- Text filters (server-side via the `Text` parameter) -------------------
  setTextFilter(
    key: CustomerTextFilterKey,
    value: string,
    operator?: CustomerFilterOperator,
  ): void {
    const current = { ...this.textFilters() };
    const operators = { ...this.textFilterOperators() };
    if ((value ?? '').trim()) {
      current[key] = value.trim();
      operators[key] = operator ?? operators[key] ?? DEFAULT_TEXT_OPERATOR;
    } else {
      delete current[key];
      delete operators[key];
    }
    this.textFilters.set(current);
    this.textFilterOperators.set(operators);
    this.page.set(1);
    this.reloadSource$.next();
  }

  /** Applies a complete text/numeric filter row (field + operator + value). */
  applyTextFilter(
    key: CustomerTextFilterKey,
    operator: CustomerFilterOperator,
    value: string,
  ): void {
    this.setTextFilter(key, value, operator);
  }

  /** Removes a single text filter (and its operator). */
  clearTextFilter(key: CustomerTextFilterKey): void {
    this.setTextFilter(key, '');
  }

  clearTextFilters(): void {
    this.textFilters.set({});
    this.textFilterOperators.set({});
    this.page.set(1);
    this.reloadSource$.next();
  }

  // --- Column visibility -------------------------------------------------------
  isColumnVisible(field: CustomerFieldKey): boolean {
    return !this.hiddenColumns().has(field);
  }

  /** Shows/hides one column. At least one column must stay visible. */
  setColumnVisible(field: CustomerFieldKey, visible: boolean): void {
    this.hiddenColumns.update((hidden) => {
      const next = new Set(hidden);
      if (visible) {
        next.delete(field);
      } else {
        if (this.selectedColumnDefs().length <= 1) {
          return hidden;
        }
        next.add(field);
      }
      return next;
    });
  }

  /** Restores the reference grid's default column selection. */
  resetColumns(): void {
    this.hiddenColumns.set(createDefaultHiddenColumns());
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

  // --- Form dialog ------------------------------------------------------------
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
   * Runs the SaveCustomerWithContactPerson upsert. Duplicate submits are
   * blocked via the `saving` signal; on success the list is refreshed.
   */
  saveCustomer(payload: CustomerPayload): Observable<SaveCustomerResult> {
    if (this.saving()) {
      return EMPTY;
    }
    this.saving.set(true);
    this.saveError.set(null);

    return this.customerService.saveCustomer(payload).pipe(
      map((result) => {
        if (result.success) {
          // Bust the query cache so the refreshed list is fetched from the server.
          this.lastExecutedQuery = null;
          this.reloadSource$.next();
        }
        return result;
      }),
      catchError((error: unknown) => {
        this.saveError.set(messageFrom(error));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  /** Factory for the form payload with sane defaults. */
  createPayload(): CustomerPayload {
    return createCustomerPayloadDefaults();
  }

  // --- Query execution ---------------------------------------------------------

  private executeSearch(term: string): Observable<CustomerListResult> {
    return this.executeQuery({ ...this.currentQuery(), search: term });
  }

  /**
   * Runs a server query into the store. Identical consecutive queries and
   * queries that start while another one is still in flight are dropped so
   * no duplicate requests hit the network.
   */
  private executeQuery(query: CustomerQuery): Observable<CustomerListResult> {
    if (
      this.loading() ||
      (this.lastExecutedQuery !== null && isCustomerQueryEqual(this.lastExecutedQuery, query))
    ) {
      return EMPTY;
    }

    this.lastExecutedQuery = query;
    this.loading.set(true);
    this.error.set(null);
    this.loadWarning.set(null);

    return this.customerService.fetchCustomers(query).pipe(
      tap((result) => {
        const records = capRecords(result.records);
        this.records.set(records);
        this.totalCount.set(result.total);
        if (records.length < result.records.length) {
          this.loadWarning.set(
            `The server returned ${result.records.length.toLocaleString()} matching records. ` +
              `For safety this app caps the loaded set at ${environment.customers.maxRecordsToLoad.toLocaleString()} — ` +
              `narrow your search to work with a smaller set.`,
          );
        }
      }),
      catchError((error: unknown) => {
        this.lastExecutedQuery = null;
        this.error.set(messageFrom(error));
        return EMPTY;
      }),
      finalize(() => this.loading.set(false)),
    );
  }
}

function capRecords(records: CustomerRecord[]): CustomerRecord[] {
  const cap = environment.customers.maxRecordsToLoad;
  return records.length > cap ? records.slice(0, cap) : records;
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

const TEXT_FILTER_KEYS: readonly CustomerTextFilterKey[] = [
  'id',
  'code',
  'name',
  'email',
  'mobile',
];

/** Record field each text filter key targets. */
const TEXT_FILTER_FIELDS: Record<CustomerTextFilterKey, CustomerFieldKey> = {
  id: 'id',
  code: 'code',
  name: 'commercialName',
  email: 'email',
  mobile: 'mobile',
};

/**
 * Applies a filter operator to a single record. Numeric comparisons are used
 * when the target field is numeric (ID); everything else is string matching.
 */
function matchesFilterOperator(
  record: CustomerRecord,
  key: CustomerTextFilterKey,
  rawValue: string | undefined,
  operator: CustomerFilterOperator | undefined,
): boolean {
  const value = (rawValue ?? '').trim();
  if (!value) {
    return true;
  }
  const fieldValue = record[TEXT_FILTER_FIELDS[key]];
  if (key === 'id') {
    const needle = Number(value);
    if (!Number.isFinite(needle)) {
      return true;
    }
    const actual = Number(fieldValue);
    switch (operator) {
      case 'greaterThan':
        return actual > needle;
      case 'greaterThanOrEqual':
        return actual >= needle;
      case 'lessThan':
        return actual < needle;
      case 'lessThanOrEqual':
        return actual <= needle;
      case 'equals':
        return actual === needle;
      default:
        return String(actual).includes(String(needle));
    }
  }
  const text = String(fieldValue ?? '');
  const lowerNeedle = value.toLowerCase();
  const lowerText = text.toLowerCase();
  switch (operator) {
    case 'equals':
      return lowerText === lowerNeedle;
    case 'startsWith':
      return lowerText.startsWith(lowerNeedle);
    case 'endsWith':
      return lowerText.endsWith(lowerNeedle);
    case 'contains':
    default:
      return lowerText.includes(lowerNeedle);
  }
}
