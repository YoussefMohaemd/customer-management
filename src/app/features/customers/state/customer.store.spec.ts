import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';

import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { environment } from '@environments/environment';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerActionDef } from '@features/customers/models/customer.model';
import { CustomerReportDef } from '@features/customers/models/customer.model';
import { DEFAULT_VISIBLE_CUSTOMER_COLUMNS } from '@features/customers/models/customer-column.model';
import { customerFixture } from '@app/testing/test-utils.spec';

const READ_URL = `${environment.api.bffBaseUrl}${environment.api.bff.customers}`;
const LOOKUPS_URL = `${environment.api.bffBaseUrl}${environment.api.bff.lookups}`;
const EXPORT_URL = `${environment.api.bffBaseUrl}${environment.api.bff.exportCustomers}`;
const SAVE_URL = `${environment.api.bffBaseUrl}${environment.api.bff.saveCustomer}`;

const READ_MATCH = (req: { url: string }) => req.url === READ_URL;

function deployStore(): { store: CustomerStore; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  const store = TestBed.inject(CustomerStore);
  const http = TestBed.inject(HttpTestingController);
  // The store warms the lookups endpoint in its constructor; settle it so it
  // never interferes with request-count assertions.
  http
    .expectOne((req) => req.url === LOOKUPS_URL)
    .flush({
      clientTypes: [],
      accountManagers: [],
      cities: [],
      countries: [],
    });
  return { store, http };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const actionFixture = (overrides: Partial<CustomerActionDef> = {}): CustomerActionDef => ({
  id: 'reassign',
  icon: 'pi-share-alt',
  title: 'Collective Reassign',
  description: 'Reassign selected customers to another account manager.',
  accent: 'blue',
  requiredColumns: ['accountManagerName', 'code', 'commercialName'],
  requiresSelection: true,
  ...overrides,
});

const reportFixture = (overrides: Partial<CustomerReportDef> = {}): CustomerReportDef => ({
  id: 'contacts',
  icon: 'pi-phone',
  title: 'Contacts Report',
  subtitle: 'Report For Contacts.',
  accent: 'blue',
  requiredColumns: ['id', 'code', 'commercialName', 'email', 'mobile', 'phone'],
  defaultSortField: 'commercialName',
  defaultSortDirection: 'asc',
  filterCriteria: { anyOf: ['email', 'mobile', 'phone'] },
  ...overrides,
});

describe('CustomerStore (BFF server-side pipeline)', () => {
  describe('one table-state change → one request', () => {
    it('reload() requests ONLY page 1 with the default page size and applies {data, totalCount}', () => {
      const { store, http } = deployStore();

      store.reload();
      expect(store.loading()).toBe(true);

      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('pageSize')).toBe('5');
      request.flush({
        data: [customerFixture({ id: 1 }), customerFixture({ id: 2 })],
        totalCount: 14111,
      });

      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      // records() IS the server page — never more than pageSize.
      expect(store.records().map((r) => r.id)).toEqual([1, 2]);
      expect(store.totalCount()).toBe(14111);
      expect(store.isEmptyResult()).toBe(false);
    });

    it('drops repeated identical queries (no duplicate requests)', () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 0 });

      store.reload();
      // Fresh trigger but identical query → short-circuited before the network.
      http.expectNone(READ_MATCH);
      expect(store.loading()).toBe(false);
    });

    it('refresh() bypasses the dedupe guard and issues a fresh request', () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_MATCH).flush({ data: [customerFixture({ id: 1 })], totalCount: 9 });

      store.refresh();
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('page')).toBe('1');
      request.flush({ data: [customerFixture({ id: 2 })], totalCount: 9 });
      expect(store.records().map((r) => r.id)).toEqual([2]);
    });
  });

  describe('server pagination', () => {
    it('navigates pages through the BFF and drives the paginator from totalCount', () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne(READ_MATCH)
        .flush({
          data: Array.from({ length: 5 }, (_, i) => customerFixture({ id: i + 1 })),
          totalCount: 12,
        });
      expect(store.totalRecords()).toBe(12);
      expect(store.totalPages()).toBe(3);
      expect(store.pageStartIndex()).toBe(1);
      expect(store.pageEndIndex()).toBe(5);

      store.setPage(2);
      const page2 = http.expectOne(READ_MATCH);
      expect(page2.request.params.get('page')).toBe('2');
      expect(page2.request.params.get('pageSize')).toBe('5');
      page2.flush({
        data: Array.from({ length: 5 }, (_, i) => customerFixture({ id: 6 + i })),
        totalCount: 12,
      });

      expect(store.page()).toBe(2);
      expect(store.records().map((r) => r.id)).toEqual([6, 7, 8, 9, 10]);
      expect(store.pageStartIndex()).toBe(6);
      expect(store.pageEndIndex()).toBe(10);
    });

    it('page-size changes reset to page 1 and request the new size', () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 50 });
      store.setPage(3);
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 50 });

      store.setPageSize(10);
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('pageSize')).toBe('10');
      request.flush({ data: [], totalCount: 50 });
      expect(store.page()).toBe(1);
      expect(store.pageSize()).toBe(10);
    });
  });

  describe('server-side search', () => {
    it('debounces typing, fires one request and resets pagination to page 1', async () => {
      const { store, http } = deployStore();

      store.search('acme');
      await delay(100);
      store.search('acme corp');
      await delay(100);
      store.search('acme corp ltd');

      http.expectNone(READ_MATCH);

      await delay(450);
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('search')).toBe('acme corp ltd');
      expect(request.request.params.get('page')).toBe('1');
      request.flush({ data: [customerFixture({ id: 3 })], totalCount: 1 });

      expect(store.searchTerm()).toBe('acme corp ltd');
      expect(store.records()).toHaveLength(1);
      expect(store.page()).toBe(1);
    });

    it('searching while on a later page returns to page 1', async () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 100 });
      store.setPage(4);
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 100 });

      store.search('john');
      await delay(450);
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('search')).toBe('john');
      request.flush({ data: [], totalCount: 100 });
    });
  });

  describe('server-side sort and filters', () => {
    it('sends the canonical sort field and toggles direction', () => {
      const { store, http } = deployStore();

      store.setSort('accountManagerName');
      const first = http.expectOne(READ_MATCH);
      expect(first.request.params.get('sortField')).toBe('AccountManagerName');
      expect(first.request.params.get('sortDirection')).toBe('asc');
      expect(first.request.params.get('page')).toBe('1');
      first.flush({ data: [], totalCount: 0 });

      store.setSort('accountManagerName'); // same column → toggle
      const second = http.expectOne(READ_MATCH);
      expect(second.request.params.get('sortDirection')).toBe('desc');
      second.flush({ data: [], totalCount: 0 });
    });

    it('sends text filters as JSON parameters', () => {
      const { store, http } = deployStore();

      store.setTextFilter('name', 'acme');
      const request = http.expectOne(READ_MATCH);
      expect(JSON.parse(request.request.params.get('textFilters')!)).toEqual({ name: 'acme' });
      expect(JSON.parse(request.request.params.get('textOperators')!)).toEqual({
        name: 'contains',
      });
      request.flush({ data: [], totalCount: 0 });

      store.setTextFilter('name', '');
      const cleared = http.expectOne(READ_MATCH);
      expect(cleared.request.params.get('textFilters')).toBeNull();
      cleared.flush({ data: [], totalCount: 0 });
      expect(store.hasFilters()).toBe(false);
    });

    it('sends categorical filter ids', () => {
      const { store, http } = deployStore();

      store.setCategoricalFilter('clientTypeId', 12);
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('clientTypeId')).toBe('12');
      request.flush({ data: [], totalCount: 0 });
    });

    it('clearing all filters reloads the unfiltered page 1', () => {
      const { store, http } = deployStore();

      store.setTextFilter('name', 'acme');
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 0 });
      store.setCategoricalFilter('cityId', 1);
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 0 });

      store.clearAllFilters();
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('textFilters')).toBeNull();
      expect(request.request.params.get('cityId')).toBeNull();
      expect(request.request.params.get('page')).toBe('1');
      request.flush({ data: [], totalCount: 0 });
      expect(store.totalFilterCount()).toBe(0);
    });
  });

  describe('cancellation: the latest request wins', () => {
    it('rapid refreshes cancel stale in-flight requests without clearing loading', () => {
      const { store, http } = deployStore();

      store.refresh(); // request A
      store.refresh(); // request B supersedes A
      expect(store.loading()).toBe(true);

      const pending = http.match(READ_MATCH);
      expect(pending.length).toBe(2);
      // The stale request A was cancelled outright…
      expect(pending[0].cancelled).toBe(true);
      expect(pending[1].cancelled).toBe(false);
      // …and its cancellation must NOT clear the loading flag of request B.
      expect(store.loading()).toBe(true);

      // Only the latest response can reach the UI.
      pending[1].flush({ data: [customerFixture({ id: 99 })], totalCount: 12 });
      expect(store.loading()).toBe(false);
      expect(store.records().map((r) => r.id)).toEqual([99]);
    });
  });

  describe('error handling', () => {
    it('surfaces a 401 as a user-friendly error and clears it on retry', () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_MATCH).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(store.error()).toContain('not authorized');
      expect(store.loading()).toBe(false);
      expect(store.hasRecords()).toBe(false);

      // Retry path issues a brand-new request.
      store.reload();
      http.expectOne(READ_MATCH).flush({ data: [customerFixture({ id: 2 })], totalCount: 1 });
      expect(store.error()).toBeNull();
      expect(store.records()).toHaveLength(1);
    });
  });

  describe('lookups (BFF dropdown options)', () => {
    it('loads distinct filter options in the background', () => {
      const { store } = deployStore();

      // The constructor request was settled by deployStore; lookups are a
      // background concern and never block the table.
      expect(store.lookups()).toEqual({
        clientTypes: [],
        accountManagers: [],
        cities: [],
        countries: [],
      });
      expect(store.clientTypeOptions()).toEqual([]);
    });
  });

  describe('export', () => {
    it('fetches the full matching set from the export endpoint (no pagination)', () => {
      const { store, http } = deployStore();

      let exported: { id: number }[] = [];
      store.exportAll().subscribe((records) => (exported = records));

      const request = http.expectOne((req) => req.url === EXPORT_URL);
      expect(request.request.params.get('page')).toBeNull();
      expect(request.request.params.get('pageSize')).toBeNull();
      request.flush({
        data: [customerFixture({ id: 1 }), customerFixture({ id: 2 })],
        totalCount: 2,
      });
      expect(exported.map((r) => r.id)).toEqual([1, 2]);
    });
  });

  describe('batch-action selection', () => {
    it('toggles individual rows by stable id', () => {
      const { store } = deployStore();

      const a = customerFixture({ id: 42 });
      const b = customerFixture({ id: 43 });
      store.toggleSelection(a);
      store.toggleSelection(b);
      store.toggleSelection(a);

      expect(store.selectedRecordsForAction().map((r) => r.id)).toEqual([43]);
      expect(store.isSelected(43)).toBe(true);
      expect(store.isSelected(42)).toBe(false);
    });

    it('keeps selections across server pages and reconciles PrimeNG events', () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne(READ_MATCH)
        .flush({
          data: Array.from({ length: 5 }, (_, i) => customerFixture({ id: i + 1 })),
          totalCount: 12,
        });

      store.selectAction(actionFixture());
      expect(store.selectionEnabled()).toBe(true);

      store.syncSelection(store.paginatedCustomers().slice(0, 2));
      expect(store.selectedRecordsForAction().map((r) => r.id)).toEqual([1, 2]);

      store.setPage(2);
      http
        .expectOne(READ_MATCH)
        .flush({
          data: Array.from({ length: 5 }, (_, i) => customerFixture({ id: 6 + i })),
          totalCount: 12,
        });
      const page2 = store.paginatedCustomers();
      store.syncSelection([...store.selectedOnPage(), ...page2.slice(0, 2)]);
      expect(
        store
          .selectedRecordsForAction()
          .map((r) => r.id)
          .sort(),
      ).toEqual([1, 2, 6, 7]);

      // The header checkbox "select all on page" also lands in the store.
      store.setPage(1);
      http
        .expectOne(READ_MATCH)
        .flush({
          data: Array.from({ length: 5 }, (_, i) => customerFixture({ id: i + 1 })),
          totalCount: 12,
        });
      store.syncSelection(store.paginatedCustomers());
      expect(
        store
          .selectedRecordsForAction()
          .map((r) => r.id)
          .sort(),
      ).toEqual([1, 2, 3, 4, 5, 6, 7]);

      store.clearAction();
      expect(store.selectedRecordsForAction()).toEqual([]);
      expect(store.selectionEnabled()).toBe(false);
    });
  });

  describe('action/report column overrides', () => {
    it('action shows exactly its required columns and restores user columns', () => {
      const { store } = deployStore();

      store.selectAction(actionFixture());
      expect(new Set(store.selectedColumnDefs().map((c) => c.field))).toEqual(
        new Set(['accountManagerName', 'code', 'commercialName']),
      );
      expect(store.selectionEnabled()).toBe(true);

      store.selectAction(actionFixture()); // toggle off
      expect(store.activeAction()).toBeNull();
      expect(store.selectionEnabled()).toBe(false);
      expect(store.selectedColumnDefs().map((c) => c.field)).toEqual([
        ...DEFAULT_VISIBLE_CUSTOMER_COLUMNS,
      ]);
    });

    it('report applies its columns + sort and restores the user sort on deactivate', () => {
      const { store } = deployStore();

      store.setSort('email');
      const userSort = store.sortField();

      store.selectReport(reportFixture());
      expect(store.selectedColumnDefs().map((c) => c.field)).toEqual([
        'id',
        'code',
        'commercialName',
        'email',
        'mobile',
        'phone',
      ]);
      expect(store.sortField()).toBe('commercialName');
      expect(store.sortDirection()).toBe('asc');

      store.clearReport();
      expect(store.activeReport()).toBeNull();
      expect(store.sortField()).toBe(userSort);
      expect(store.selectedColumnDefs().map((c) => c.field)).toEqual([
        ...DEFAULT_VISIBLE_CUSTOMER_COLUMNS,
      ]);
    });

    it('activating a report deactivates the action and vice versa', () => {
      const { store } = deployStore();

      store.selectAction(actionFixture());
      expect(store.activeAction()).not.toBeNull();

      store.selectReport(reportFixture());
      expect(store.activeAction()).toBeNull();
      expect(store.activeReport()).not.toBeNull();
      expect(store.selectedRecordsForAction()).toEqual([]);

      store.selectAction(actionFixture());
      expect(store.activeReport()).toBeNull();
      expect(store.activeAction()).not.toBeNull();
    });
  });

  describe('reports filter the table data source', () => {
    it('selecting a report sends its id to the BFF; clearing it drops the param', () => {
      const { store, http } = deployStore();

      store.selectReport(reportFixture());
      let request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBe('contacts');
      request.flush({ data: [customerFixture({ id: 1 })], totalCount: 13868 });

      expect(store.records().map((r) => r.id)).toEqual([1]);

      store.clearReport();
      request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBeNull();
      request.flush({ data: [customerFixture({ id: 2 })], totalCount: 14111 });
      expect(store.records().map((r) => r.id)).toEqual([2]);
    });

    it('clicking the active report again clears it (toggle) and reloads unfiltered', () => {
      const { store, http } = deployStore();

      store.selectReport(reportFixture());
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 13868 });
      expect(store.activeReport()).not.toBeNull();

      store.selectReport(reportFixture());
      expect(store.activeReport()).toBeNull();
      const request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBeNull();
      request.flush({ data: [], totalCount: 14111 });
    });

    it('switching reports issues one request even when the sort stays identical', () => {
      const { store, http } = deployStore();

      store.selectReport(reportFixture({ id: 'customers', defaultSortField: 'id' }));
      let request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBe('customers');
      request.flush({ data: [], totalCount: 13683 });

      // Same sort as the previous report, different report id → not deduped.
      store.selectReport(reportFixture({ id: 'account-follow-up', defaultSortField: 'id' }));
      request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBe('account-follow-up');
      request.flush({ data: [], totalCount: 428 });
    });

    it('report selection stays active across pagination and page-size changes', () => {
      const { store, http } = deployStore();

      store.selectReport(reportFixture());
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 13868 });

      store.setPage(2);
      let request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBe('contacts');
      expect(request.request.params.get('page')).toBe('2');
      request.flush({ data: [], totalCount: 13868 });

      store.setPageSize(10);
      request = http.expectOne(READ_MATCH);
      expect(request.request.params.get('report')).toBe('contacts');
      expect(request.request.params.get('pageSize')).toBe('10');
      request.flush({ data: [], totalCount: 13868 });
    });
  });

  describe('save flow', () => {
    it('saves, closes saving state and refreshes the list on success', () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_MATCH).flush({ data: [], totalCount: 0 });

      let saved = false;
      store.saveCustomer(store.createPayload()).subscribe({
        next: (result) => (saved = result.success),
        error: () => undefined,
      });

      expect(store.saving()).toBe(true);
      http
        .expectOne((req) => req.method === 'POST' && req.url === SAVE_URL)
        .flush({
          Result: true,
          ErrorMessage: 'Saved Successfully || Id : 77',
        });
      expect(store.saving()).toBe(false);
      expect(saved).toBe(true);

      // Success triggers a fresh list fetch through the BFF.
      http.expectOne(READ_MATCH).flush({ data: [customerFixture({ id: 77 })], totalCount: 1 });
      expect(store.records().map((r) => r.id)).toEqual([77]);
      expect(store.saveError()).toBeNull();
    });

    it('keeps the dialog state and reports save failures', () => {
      const { store, http } = deployStore();

      store.openCreateForm();
      store.saveCustomer(store.createPayload()).subscribe({ error: () => undefined });

      http
        .expectOne((req) => req.method === 'POST' && req.url === SAVE_URL)
        .flush({ Result: false, ErrorMessage: 'Sorry,Mobile already Exist.' });
      expect(store.saving()).toBe(false);
      expect(store.saveError()).toBe('Sorry,Mobile already Exist.');
    });
  });

  describe('dialog state', () => {
    it('opens create/edit/view and closes', () => {
      const { store } = deployStore();

      store.openCreateForm();
      expect(store.formOpen()).toBe(true);
      expect(store.formMode()).toBe('create');

      const customer = customerFixture({ id: 9 });
      store.openEditForm(customer);
      expect(store.formMode()).toBe('edit');
      expect(store.formCustomer()?.id).toBe(9);

      store.closeForm();
      expect(store.formOpen()).toBe(false);
      expect(store.formCustomer()).toBeNull();
    });
  });
});
