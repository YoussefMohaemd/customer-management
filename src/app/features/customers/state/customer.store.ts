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
  CustomerFilters,
  CustomerFilterKey,
  CustomerFilterOperator,
  CustomerLookups,
  CustomerQuery,
  CustomerSortField,
  CustomerTextFilterKey,
  CATEGORICAL_FILTER_KEYS,
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
 * Signal-based customer store backed by the Customer BFF.
 *
 * Architecture: Angular NEVER downloads the full customer dataset. Every
 * table-state change (search, text/categorical filters, pagination, sorting,
 * report sort override, retry/refresh) is pushed into ONE RxJS pipeline:
 *
 *   merge(debounced typing, immediate changes) → switchMap(executeQuery)
 *
 * `switchMap` guarantees the latest request wins and stale responses can
 * never overwrite newer ones; the query-equality check short-circuits
 * repeated identical queries; search typing is debounced (400 ms). The BFF
 * (see `server/`) applies search/filter/sort/pagination server-side over its
 * cached dataset and returns ONLY the requested page plus the total count —
 * so the store never holds more than `pageSize` records (5/10/20).
 *
 * Filter dropdown options come from the BFF `lookups` endpoint (distinct
 * values over the full cached dataset), never from the current page.
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

  // --- Lookup options for categorical filters ----------------------------------
  /**
   * Distinct dropdown options served by the BFF lookups endpoint. They are
   * derived server-side over the FULL cached dataset — never from the current
   * page — so the options cover all customers, not only the visible 5/10/20.
   */
  readonly lookups = signal<CustomerLookups | null>(null);

  readonly clientTypeOptions = computed(() => this.lookups()?.clientTypes ?? []);
  readonly accountManagerOptions = computed(() => this.lookups()?.accountManagers ?? []);
  readonly cityOptions = computed(() => this.lookups()?.cities ?? []);
  readonly countryOptions = computed(() => this.lookups()?.countries ?? []);

  // --- Async pipeline --------------------------------------------------------
  /** Debounced triggers: search box typing. */
  private readonly typingSource$ = new Subject<CustomerQuery>();
  /** Immediate triggers: pagination, sorting, filters, reload, report sort. */
  private readonly changeSource$ = new Subject<CustomerQuery>();

  private lastExecutedQuery: CustomerQuery | null = null;

  /**
   * Monotonic counter identifying the latest query execution. Used to make
   * `loading` immune to stale requests: when `switchMap` cancels an older
   * in-flight request, that request's `finalize` must not clear the loading
   * flag of the newer request that superseded it.
   */
  private requestSeq = 0;

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

    // Fire-and-forget: dropdown options load in the background; the table is
    // never blocked on them.
    this.loadLookups();
  }

  // --- Derived state --------------------------------------------------------
  /** Total records for the paginator — the server-provided matching count. */
  readonly totalRecords = computed(() => this.totalCount());

  /**
   * Current page items. In the BFF architecture `records()` IS the server
   * page — the grid receives exactly what the API returned (≤ pageSize).
   */
  readonly paginatedCustomers = computed<CustomerRecord[]>(() => this.records());

  readonly totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.totalCount() / size));
  });

  readonly pageStartIndex = computed(() => {
    const count = this.totalCount();
    return count === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1;
  });
  readonly pageEndIndex = computed(() =>
    Math.min(this.page() * this.pageSize(), this.totalCount()),
  );
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

  // --- Query assembly ---------------------------------------------------------
  private currentQuery(): CustomerQuery {
    return {
      search: this.searchTerm(),
      textFilters: this.textFilters(),
      textFilterOperators: this.textFilterOperators(),
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
   * refresh). An identical query is deduped so no duplicate request is sent.
   */
  reload(): void {
    this.changeSource$.next(this.currentQuery());
  }

  /**
   * Hard refresh for the pagination Refresh button: always returns to
   * page 1 and re-runs the query, bypassing the dedupe guard so a fresh
   * request reaches the BFF even when the query is unchanged.
   */
  refresh(): void {
    this.page.set(1);
    this.lastExecutedQuery = null;
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

  // --- Text filters (applied server-side by the BFF over its cached set) -----
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
   * Runs the SaveCustomerWithContactPerson upsert through the BFF. Duplicate
   * submits are blocked via the `saving` signal; on success the list is
   * refreshed (the BFF serves the cached dataset instantly while refreshing
   * it in the background).
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
          // Bypass the dedupe guard so the refreshed list is fetched from the
          // BFF instead of being dropped as an identical query.
          this.lastExecutedQuery = null;
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

  /**
   * Fetches the complete matching set (search + filters + sort applied) from
   * the BFF — used by the Excel export so the file covers the whole result
   * set, never just the visible page.
   */
  exportAll(): Observable<CustomerRecord[]> {
    return this.customerService.fetchCustomersForExport(this.currentQuery());
  }

  // --- Query execution ---------------------------------------------------------

  /**
   * Runs a server query into the store. Identical consecutive queries are
   * dropped so no duplicate requests hit the network. In-flight requests are
   * cancelled by the pipeline's `switchMap` — the latest query always wins.
   */
  private executeQuery(query: CustomerQuery): Observable<CustomerListResult> {
    if (this.lastExecutedQuery !== null && isCustomerQueryEqual(this.lastExecutedQuery, query)) {
      return EMPTY;
    }

    this.lastExecutedQuery = query;

    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);

    return this.customerService.fetchCustomers(query).pipe(
      tap((result) => this.applyResult(result)),
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

  /** Publishes a fetched result into the store's signals. */
  private applyResult(result: CustomerListResult): void {
    // The response already IS the current page; the server total drives the
    // paginator. No slicing, no client-side processing — records() holds at
    // most `pageSize` items.
    this.records.set(result.records);
    this.totalCount.set(result.total);
  }

  private loadLookups(): void {
    this.customerService
      .fetchLookups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lookups) => this.lookups.set(lookups),
        error: () => {
          // Lookups are progressive enhancement: the table and filters keep
          // working; the dropdowns simply stay empty until they load.
        },
      });
  }
}

function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}