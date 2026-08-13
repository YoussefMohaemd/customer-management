import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  EMPTY,
  finalize,
  map,
  merge,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '@environments/environment';
import {
  CustomerActionDef,
  CustomerListResult,
  CustomerPayload,
  CustomerRecord,
  CustomerReportDef,
  createCustomerPayloadDefaults,
} from '@features/customers/models/customer.model';
import {
  CATEGORICAL_FILTER_KEYS,
  CustomerFilters,
  CustomerFilterKey,
  CustomerFilterOperator,
  CustomerQuery,
  CustomerSortField,
  CustomerTextFilterKey,
  DEFAULT_TEXT_OPERATOR,
  EMPTY_CUSTOMER_FILTERS,
  SortDirection,
  TEXT_FILTER_KEYS,
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
 * Every query change (search, text/categorical filters, pagination, sorting,
 * report sort override, retry/refresh) is pushed into ONE RxJS pipeline:
 *
 *   merge(debounced typing, immediate changes) → switchMap(executeQuery)
 *
 * `switchMap` guarantees the latest request wins and stale responses can
 * never overwrite newer ones; the query-equality check short-circuits
 * repeated identical queries. Search typing is debounced (400 ms).
 *
 * Legacy Read API (verified live): only `Text`, `Direction`, `InCT` are
 * sent; the API returns the FULL matching collection as `{ Data, Total }`.
 * Because the server cannot paginate, the matching set for each search term
 * is cached in memory (TTL-bounded) — pagination, sorting and filtering are
 * then derived instantly over the cache with zero extra network traffic, and
 * repeated visits to the page render instantly. Search-term changes hit the
 * API (debounced); the Refresh button and successful Saves bust the cache.
 * When `environment.customers.serverPagination` is enabled the request
 * carries the full proposed paged contract, the store renders exactly the
 * server page and the paginator uses the server `Total` (see README → Known
 * API Limitations and Proposed Backend Contract).
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

  // --- Actions & Reports state -----------------------------------------------
  readonly activeAction = signal<CustomerActionDef | null>(null);
  readonly activeReport = signal<CustomerReportDef | null>(null);

  /** The user's sort configuration, captured before a report overrides it. */
  private readonly userSortSnapshot = signal<{
    field: CustomerSortField | null;
    direction: SortDirection;
  }>({ field: null, direction: 'asc' });

  // --- Column presentation state ---------------------------------------------
  readonly allColumnDefs = signal<CustomerColumnDef[]>([...CUSTOMER_COLUMNS]);
  readonly userHiddenColumns = signal<ReadonlySet<CustomerFieldKey>>(createDefaultHiddenColumns());

  /**
   * Effective column visibility. While an Action/Report override is active
   * the table shows exactly the override's required columns; otherwise the
   * user's own selection. The user's selection is never mutated by the
   * override, so deactivating the mode restores it exactly.
   */
  readonly hiddenColumns = computed<ReadonlySet<CustomerFieldKey>>(() => {
    const override = this.activeReport() ?? this.activeAction();
    if (override && override.requiredColumns && override.requiredColumns.length > 0) {
      const required = new Set<CustomerFieldKey>(override.requiredColumns);
      return new Set(
        this.allColumnDefs()
          .map((column) => column.field)
          .filter((field) => !required.has(field)),
      );
    }
    return this.userHiddenColumns();
  });

  /** Columns rendered by the table (override-aware). */
  readonly selectedColumnDefs = computed(() =>
    this.allColumnDefs().filter((column) => !this.hiddenColumns().has(column.field)),
  );

  /** The user's own column selection — what the column picker edits. */
  readonly userSelectedColumnDefs = computed(() =>
    this.allColumnDefs().filter((column) => !this.userHiddenColumns().has(column.field)),
  );

  /** Filterable columns of the user's selection (drives the filter panel + chips). */
  readonly filterableColumnDefs = computed(() =>
    this.userSelectedColumnDefs().filter((column) => column.filter !== undefined),
  );

  readonly visibleColumnCount = computed(() => this.userSelectedColumnDefs().length);

  // --- UI state -------------------------------------------------------------
  readonly selectedCustomer = signal<CustomerRecord | null>(null);
  readonly formOpen = signal(false);
  readonly formMode = signal<CustomerFormMode>('edit');
  readonly formCustomer = signal<CustomerRecord | null>(null);

  // --- Batch-action selection state ------------------------------------------
  /** Stable record objects selected for the active action (id-keyed, survives pagination). */
  readonly selectedRecordsForAction = signal<CustomerRecord[]>([]);

  readonly selectionEnabled = computed(() => this.activeAction()?.requiresSelection ?? false);

  /** The slice of the selection that lives on the currently rendered page. */
  readonly selectedOnPage = computed(() => {
    if (!this.selectionEnabled()) {
      return [];
    }
    const ids = new Set(this.selectedRecordsForAction().map((record) => record.id));
    return this.paginatedCustomers().filter((record) => ids.has(record.id));
  });

  private lastExecutedQuery: CustomerQuery | null = null;

  /**
   * True when the Read API implements the proposed paged contract
   * (`environment.customers.serverPagination`). In that mode the server
   * applies filtering, sorting and pagination and returns only the current
   * page plus the total count, so the client-side filter/sort/slice chain is
   * bypassed and the grid renders exactly the server page. In legacy mode
   * (current API — see README → Known API Limitations) the full matching set
   * is loaded once, capped, and the page is derived over it.
   */
  private readonly serverPaging = environment.customers.serverPagination;

  /**
   * Monotonic counter identifying the latest query execution. Used to make
   * `loading` immune to stale requests: when `switchMap` cancels an older
   * in-flight request, that request's `finalize` must not clear the loading
   * flag of the newer request that superseded it.
   */
  private requestSeq = 0;

  /**
   * In-memory cache of completed legacy-API reads, keyed by the search term
   * (the only server-narrowing parameter the Read API supports). Pagination,
   * sorting and per-field/categorical filters are derived client-side over
   * the cached matching set, so after one successful fetch for a term every
   * table state change is served instantly with ZERO network traffic. The
   * entry expires after `environment.customers.cacheTtlMs`; the explicit
   * Refresh button and a successful Save always bust the current entry.
   */
  private readonly searchCache = new Map<string, { result: CustomerListResult; fetchedAt: number }>();

  // --- Async pipeline --------------------------------------------------------
  /** Debounced triggers: search box typing. */
  private readonly typingSource$ = new Subject<CustomerQuery>();
  /** Immediate triggers: pagination, sorting, filters, reload, report sort. */
  private readonly changeSource$ = new Subject<CustomerQuery>();

  constructor() {
    merge(
      this.typingSource$.pipe(debounceTime(environment.customers.searchDebounceMs)),
      this.changeSource$,
    )
      .pipe(
        switchMap((query) => this.executeQuery(query)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  // --- Derived state --------------------------------------------------------
  readonly categoricalFilteredRecords = computed(() => {
    if (this.serverPaging) {
      // The server already applied the categorical filters.
      return this.records();
    }
    let result = this.records();
    const catFilters = this.filters();
    if (catFilters.clientTypeId !== null) {
      result = result.filter((r) => r.accountTypeId === catFilters.clientTypeId);
    }
    if (catFilters.accountManagerId !== null) {
      result = result.filter((r) => r.accountManagerId === catFilters.accountManagerId);
    }
    if (catFilters.cityId !== null) {
      result = result.filter((r) => r.cityId === catFilters.cityId);
    }
    if (catFilters.countryId !== null) {
      result = result.filter((r) => r.countryId === catFilters.countryId);
    }
    return result;
  });

  readonly filteredRecords = computed(() => {
    if (this.serverPaging) {
      // The server already applied all filters.
      return this.records();
    }
    let result = this.categoricalFilteredRecords();

    const txtFilters = this.textFilters();
    const txtOperators = this.textFilterOperators();
    const activeKeys = (Object.keys(txtFilters) as CustomerTextFilterKey[]).filter(
      (k) => (txtFilters[k] ?? '').trim().length > 0,
    );

    if (activeKeys.length > 0) {
      result = result.filter((record) => {
        return activeKeys.every((key) =>
          matchesFilterOperator(record, key, txtFilters[key], txtOperators[key]),
        );
      });
    }

    return result;
  });

  /**
   * Total records for the paginator. In server-pagination mode this is the
   * server-provided `Total` from the response. In legacy mode it is the
   * length of the locally filtered set — the only honest count available
   * because the API returns the full matching collection.
   */
  readonly totalRecords = computed(() =>
    this.serverPaging ? this.totalCount() : this.filteredRecords().length,
  );

  readonly sortedRecords = computed(() => {
    if (this.serverPaging) {
      // The server already sorted the returned page.
      return this.filteredRecords();
    }
    const list = [...this.filteredRecords()];
    const field = this.sortField();
    const direction = this.sortDirection();
    if (!field) {
      return list;
    }
    const factor = direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * factor;
      }
      return String(valA).localeCompare(String(valB)) * factor;
    });
  });

  readonly totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    const count = this.serverPaging ? this.totalCount() : this.sortedRecords().length;
    return Math.max(1, Math.ceil(count / size));
  });

  /**
   * Renders current page items in the data grid. In server-pagination mode
   * `records()` IS the server page, so no slicing happens at all — the grid
   * receives exactly what the API returned. In legacy mode the page is
   * derived over the loaded matching set (never more than one page).
   */
  readonly paginatedCustomers = computed<CustomerRecord[]>(() => {
    if (this.serverPaging) {
      return this.sortedRecords();
    }
    const sorted = this.sortedRecords();
    const size = Math.max(1, this.pageSize());
    const currentPage = Math.min(this.page(), Math.ceil(sorted.length / size) || 1);
    const start = (currentPage - 1) * size;
    return sorted.slice(start, start + size);
  });

  readonly pageStartIndex = computed(() => {
    const count = this.serverPaging ? this.totalCount() : this.sortedRecords().length;
    return count === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1;
  });
  readonly pageEndIndex = computed(() => {
    const count = this.serverPaging ? this.totalCount() : this.sortedRecords().length;
    return Math.min(this.page() * this.pageSize(), count);
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

  // --- Lookup options for categorical filters ----------------------------------
  /**
   * Dedicated lookup data for dropdown options. In legacy mode it is seeded
   * from the first loaded set so the options cover more than the current
   * page. The current API has no lookup endpoints (see README → Known API
   * Limitations); once dedicated lookup endpoints exist, this signal is the
   * single place to feed them. In server-pagination mode it is NEVER seeded
   * from the current page — the options must not represent only the 20/50/100
   * loaded customers.
   */
  readonly lookupRecords = signal<CustomerRecord[]>([]);
  private readonly sourceForLookups = computed(() =>
    this.serverPaging
      ? this.lookupRecords()
      : this.lookupRecords().length > 0
        ? this.lookupRecords()
        : this.records(),
  );

  readonly clientTypeOptions = computed(() =>
    distinctBy(this.sourceForLookups(), (r) => r.accountTypeId).map((r) => ({
      value: r.accountTypeId,
      label: r.accountTypeName || `Client Type ${r.accountTypeId}`,
    })),
  );
  readonly accountManagerOptions = computed(() =>
    distinctBy(this.sourceForLookups(), (r) => r.accountManagerId).map((r) => ({
      value: r.accountManagerId,
      label: r.accountManagerName || `Account Manager ${r.accountManagerId}`,
    })),
  );
  readonly cityOptions = computed(() =>
    distinctBy(this.sourceForLookups(), (r) => r.cityId).map((r) => ({
      value: r.cityId,
      label: r.city || `City ${r.cityId}`,
    })),
  );
  readonly countryOptions = computed(() =>
    distinctBy(this.sourceForLookups(), (r) => r.countryId).map((r) => ({
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
    this.typingSource$.next(this.currentQuery());
  }

  /** Clears the search box; reloads the full set. */
  clearSearch(): void {
    this.searchTerm.set('');
    this.page.set(1);
    this.typingSource$.next(this.currentQuery());
  }

  /**
   * Re-runs the current query (used for retry, re-navigation and after-save
   * refresh). An identical query is normally deduped; when the cached
   * matching set is missing or expired the guard is bypassed so a fresh
   * request reaches the API.
   */
  reload(): void {
    if (this.cacheExpired(this.currentQuery())) {
      this.lastExecutedQuery = null;
    }
    this.changeSource$.next(this.currentQuery());
  }

  /**
   * Hard refresh for the pagination Refresh button: always returns to
   * page 1 and re-runs the query, busting both the dedupe guard and the
   * in-memory cache so a fresh request reaches the API even when the query
   * is unchanged.
   */
  refresh(): void {
    this.page.set(1);
    this.lastExecutedQuery = null;
    this.searchCache.delete(this.searchTerm().trim());
    this.changeSource$.next(this.currentQuery());
  }

  // --- Pagination / sorting --------------------------------------------------
  setPage(page: number): void {
    const bounded = Math.min(Math.max(page, 1), this.totalPages());
    if (this.page() !== bounded) {
      this.page.set(bounded);
      this.changeSource$.next(this.currentQuery());
    }
  }

  setPageSize(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
    this.changeSource$.next(this.currentQuery());
  }

  setSort(field: CustomerSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.page.set(1);
    this.changeSource$.next(this.currentQuery());
  }

  // --- Text filters (applied client-side over the loaded set; the request
  //     still carries the full query so the server contract stays intact) -----
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
    this.changeSource$.next(this.currentQuery());
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
    this.changeSource$.next(this.currentQuery());
  }

  // --- Column visibility -------------------------------------------------------
  isColumnVisible(field: CustomerFieldKey): boolean {
    return !this.userHiddenColumns().has(field);
  }

  /**
   * Shows/hides one column of the user's own selection (never the temporary
   * Action/Report override). At least one column must stay visible. When a
   * column is hidden its filter value is pruned so the filter panel (which
   * derives its inputs from the selected columns) never drifts from the
   * active-filter state.
   */
  setColumnVisible(field: CustomerFieldKey, visible: boolean): void {
    this.userHiddenColumns.update((hidden) => {
      const next = new Set(hidden);
      if (visible) {
        next.delete(field);
      } else {
        if (this.userSelectedColumnDefs().length <= 1) {
          return hidden;
        }
        next.add(field);
      }
      return next;
    });
    this.pruneColumnFilters();
  }

  /** Restores the reference grid's default column selection. */
  resetColumns(): void {
    if (this.activeReport()) {
      this.activeReport.set(null);
    }
    if (this.activeAction()) {
      this.activeAction.set(null);
    }
    this.userHiddenColumns.set(createDefaultHiddenColumns());
    this.pruneColumnFilters();
  }

  /**
   * Drops filter values whose column is no longer visible in the USER's
   * selection. The filter panel generates one input per selected filterable
   * column, so a hidden column must not keep filtering the result set
   * invisibly. Action/Report overrides never prune user filters.
   */
  private pruneColumnFilters(): void {
    const visibleFilterKeys = new Set<CustomerFilterKey | CustomerTextFilterKey>(
      this.userSelectedColumnDefs()
        .filter((column) => column.filter !== undefined)
        .map((column) => column.filter!.key),
    );

    const textFilters = { ...this.textFilters() };
    const operators = { ...this.textFilterOperators() };
    let textChanged = false;
    for (const key of TEXT_FILTER_KEYS) {
      if (!visibleFilterKeys.has(key) && (textFilters[key] ?? '').trim()) {
        delete textFilters[key];
        delete operators[key];
        textChanged = true;
      }
    }
    if (textChanged) {
      this.textFilters.set(textFilters);
      this.textFilterOperators.set(operators);
      this.page.set(1);
      this.changeSource$.next(this.currentQuery());
    }

    const filters = { ...this.filters() };
    let categoricalChanged = false;
    for (const key of CATEGORICAL_FILTER_KEYS) {
      if (!visibleFilterKeys.has(key) && filters[key] !== null) {
        filters[key] = null;
        categoricalChanged = true;
      }
    }
    if (categoricalChanged) {
      this.filters.set(filters);
      this.page.set(1);
      this.changeSource$.next(this.currentQuery());
    }
  }

  // --- Categorical filters ---------------------------------------------------
  setCategoricalFilter(key: CustomerFilterKey, value: number | null): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    this.page.set(1);
    this.changeSource$.next(this.currentQuery());
  }

  clearCategoricalFilters(): void {
    this.filters.set({ ...EMPTY_CUSTOMER_FILTERS });
    this.page.set(1);
    this.changeSource$.next(this.currentQuery());
  }

  clearAllFilters(): void {
    this.textFilters.set({});
    this.textFilterOperators.set({});
    this.filters.set({ ...EMPTY_CUSTOMER_FILTERS });
    this.page.set(1);
    this.changeSource$.next(this.currentQuery());
  }

  // --- Batch-action selection --------------------------------------------------
  toggleSelection(record: CustomerRecord): void {
    this.selectedRecordsForAction.update((list) =>
      list.some((item) => item.id === record.id)
        ? list.filter((item) => item.id !== record.id)
        : [...list, record],
    );
  }

  isSelected(id: number): boolean {
    return this.selectedRecordsForAction().some((record) => record.id === id);
  }

  /**
   * Reconciles the store selection with the selection PrimeNG reports after
   * a row checkbox or the header checkbox changes. Records selected on other
   * pages are preserved (selection is keyed by stable customer id).
   */
  syncSelection(next: CustomerRecord[] | CustomerRecord | null): void {
    const records = Array.isArray(next) ? next : next ? [next] : [];
    const nextIds = new Set(records.map((record) => record.id));
    const page = this.paginatedCustomers();
    const pageIds = new Set(page.map((record) => record.id));
    this.selectedRecordsForAction.update((list) => [
      ...list.filter((record) => !pageIds.has(record.id)),
      ...page.filter((record) => nextIds.has(record.id)),
    ]);
  }

  clearSelection(): void {
    this.selectedRecordsForAction.set([]);
  }

  // --- Actions & Reports integration -----------------------------------------
  selectAction(action: CustomerActionDef): void {
    this.activeReport.set(null);
    if (this.activeAction()?.id === action.id) {
      this.clearAction();
      return;
    }
    this.activeAction.set(action);
    this.selectedRecordsForAction.set([]);
    this.pruneColumnFilters();
  }

  clearAction(): void {
    this.activeAction.set(null);
    this.selectedRecordsForAction.set([]);
    this.pruneColumnFilters();
  }

  selectReport(report: CustomerReportDef): void {
    this.activeAction.set(null);
    if (this.activeReport()?.id === report.id) {
      this.clearReport();
      return;
    }
    // Capture the user's sort only once so switching reports never overwrites it.
    if (!this.activeReport()) {
      this.userSortSnapshot.set({ field: this.sortField(), direction: this.sortDirection() });
    }
    this.activeReport.set(report);
    if (report.defaultSortField) {
      this.sortField.set(report.defaultSortField);
      this.sortDirection.set(report.defaultSortDirection ?? 'asc');
    }
    this.page.set(1);
    this.pruneColumnFilters();
    this.changeSource$.next(this.currentQuery());
  }

  clearReport(): void {
    this.activeReport.set(null);
    // Restore the user's own sort (report sorting was only temporary).
    this.sortField.set(this.userSortSnapshot().field);
    this.sortDirection.set(this.userSortSnapshot().direction);
    this.pruneColumnFilters();
    this.changeSource$.next(this.currentQuery());
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
          // Bust the query guard AND the in-memory cache so the refreshed
          // list is fetched from the server, never served stale.
          this.lastExecutedQuery = null;
          this.searchCache.delete(this.searchTerm().trim());
          this.changeSource$.next(this.currentQuery());
        } else {
          this.saveError.set(result.message || 'Save failed');
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

  /**
   * Runs a server query into the store. Identical consecutive queries are
   * dropped so no duplicate requests hit the network. In-flight requests are
   * cancelled by the pipeline's `switchMap` — the latest query always wins.
   *
   * Legacy mode: the request only carries the search term to the server (the
   * API cannot paginate/sort/filter — see README → Known API Limitations), so
   * the full matching set for a term is cached. Pagination, sorting and
   * filter changes then complete synchronously from the cache — ZERO network
   * traffic — while search-term changes hit the API (debounced upstream).
   */
  private executeQuery(query: CustomerQuery): Observable<CustomerListResult> {
    if (this.lastExecutedQuery !== null && isCustomerQueryEqual(this.lastExecutedQuery, query)) {
      return EMPTY;
    }

    this.lastExecutedQuery = query;

    const cached = this.readCache(query);
    if (cached) {
      // Synchronous cache hit: apply instantly. No loading flip, no network —
      // a quick page/sort/filter change can therefore never flicker.
      this.error.set(null);
      this.loadWarning.set(null);
      this.applyResult(cached);
      return of(cached);
    }

    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    this.loadWarning.set(null);

    return this.customerService.fetchCustomers(query).pipe(
      tap((result) => {
        this.writeCache(query, result);
        this.applyResult(result);
      }),
      catchError((error: unknown) => {
        if (seq === this.requestSeq) {
          // Only the LATEST request may publish state; a superseded request's
          // failure must never overwrite a newer request's data or error.
          this.lastExecutedQuery = null;
          this.error.set(messageFrom(error));
        }
        return EMPTY;
      }),
      finalize(() => {
        if (seq === this.requestSeq) {
          this.loading.set(false);
        } else {
          // This request was superseded by a newer one. Reset the guard so a
          // future identical query is executed instead of being dropped.
          this.lastExecutedQuery = null;
        }
      }),
    );
  }

  /**
   * Serves a fresh cache entry when the query needs no server round-trip.
   * In legacy mode only the search term reaches the server, so the cache key
   * is exactly that term. In server-pagination mode every query parameter is
   * server-relevant and caching is intentionally disabled.
   */
  private readCache(query: CustomerQuery): CustomerListResult | null {
    if (this.serverPaging) {
      return null;
    }
    if (this.cacheExpired(query)) {
      this.searchCache.delete(query.search.trim());
      return null;
    }
    return this.searchCache.get(query.search.trim())!.result;
  }

  /** True when the matching set for the query's search term must be refetched. */
  private cacheExpired(query: CustomerQuery): boolean {
    if (this.serverPaging) {
      return true;
    }
    const entry = this.searchCache.get(query.search.trim());
    if (!entry) {
      return true;
    }
    return Date.now() - entry.fetchedAt > environment.customers.cacheTtlMs;
  }

  private writeCache(query: CustomerQuery, result: CustomerListResult): void {
    if (this.serverPaging) {
      return;
    }
    this.searchCache.set(query.search.trim(), { result, fetchedAt: Date.now() });
  }

  /** Publishes a fetched (or cached) result into the store's signals. */
  private applyResult(result: CustomerListResult): void {
    if (this.serverPaging) {
      // The response already is the current page; the server total drives
      // the paginator. No cap applies — the payload is bounded by pageSize.
      this.records.set(result.records);
      this.totalCount.set(result.total);
      return;
    }
    const records = capRecords(result.records);
    this.records.set(records);
    this.totalCount.set(result.total);
    if (this.lookupRecords().length === 0 && result.records.length > 0) {
      this.lookupRecords.set(result.records);
    }
    if (records.length < result.records.length) {
      this.loadWarning.set(
        `The server returned ${result.records.length.toLocaleString()} matching records. ` +
          `For safety this app caps the loaded set at ${environment.customers.maxRecordsToLoad.toLocaleString()} — ` +
          `narrow your search to work with a smaller set.`,
      );
    }
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

/** Record field each text filter key targets. */
const TEXT_FILTER_FIELDS: Record<CustomerTextFilterKey, CustomerFieldKey> = {
  id: 'id',
  code: 'code',
  name: 'commercialName',
  nameEn: 'nameEn',
  nameAr: 'nameAr',
  email: 'email',
  mobile: 'mobile',
  phone: 'phone',
  phone2: 'phone2',
  fax: 'fax',
  website: 'website',
  jobTitle: 'jobTitle',
  clientType: 'clientType',
  classificationName: 'classificationName',
  businessFieldName: 'businessFieldName',
  regionName: 'regionName',
  gender: 'gender',
  status: 'status',
  birthDate: 'birthDate',
  registrationDate: 'registrationDate',
  createdDate: 'createdDate',
  address: 'address',
  comment: 'comment',
  taxFileNumber: 'taxFileNumber',
  commercialRegistrationNumber: 'commercialRegistrationNumber',
  vatRegistrationNumber: 'vatRegistrationNumber',
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
