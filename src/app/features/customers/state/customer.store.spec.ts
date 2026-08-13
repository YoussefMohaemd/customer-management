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

const READ_URL = `${environment.api.baseUrl}${environment.api.endpoints.readAllCrmClients}`;

function deployStore(): { store: CustomerStore; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    store: TestBed.inject(CustomerStore),
    http: TestBed.inject(HttpTestingController),
  };
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
  id: 'customer-list',
  icon: 'pi-list',
  title: 'Customer List',
  subtitle: 'Full customer register with filters',
  accent: 'from-blue-500 to-indigo-600',
  requiredColumns: ['id', 'code', 'commercialName'],
  defaultSortField: 'code',
  defaultSortDirection: 'asc',
  ...overrides,
});

describe('CustomerStore', () => {
  describe('load pipeline', () => {
    it('reload() fetches the matching set into signals', async () => {
      const { store, http } = deployStore();

      store.reload();
      expect(store.loading()).toBe(true);

      const request = http.expectOne((req) => req.url === READ_URL);
      request.flush({ Data: [customerFixture({ id: 1 })], Total: 9 });

      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.records()).toHaveLength(1);
      expect(store.totalCount()).toBe(9);
      expect(store.isEmptyResult()).toBe(false);
    });

    it('drops repeated identical queries (no duplicate requests)', async () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne((req) => req.url === READ_URL).flush({ Data: [], Total: 0 });

      store.reload();
      // Fresh query state but identical parameters → short-circuited.
      http.expectNone((req) => req.url === READ_URL);
      expect(store.loading()).toBe(false);
    });

    it('surfaces a 401 as a user-friendly error and clears it on retry', async () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne((req) => req.url === READ_URL)
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(store.error()).toContain('not authorized');
      expect(store.loading()).toBe(false);
      expect(store.hasRecords()).toBe(false);

      // Retry path issues a brand-new request.
      store.reload();
      http
        .expectOne((req) => req.url === READ_URL)
        .flush({ Data: [customerFixture({ id: 2 })], Total: 1 });
      expect(store.error()).toBeNull();
      expect(store.records()).toHaveLength(1);
    });
  });

  describe('debounced server-side search', () => {
    it('debounces, keeps only the last term and fires one request', async () => {
      const { store, http } = deployStore();

      store.search('acme');
      await delay(100);
      store.search('acme corp');
      await delay(100);
      store.search('acme corp ltd');

      http.expectNone((req) => req.url === READ_URL);

      await delay(450);
      const request = http.expectOne((req) => req.url === READ_URL);
      expect(request.request.params.get('Text')).toBe('acme corp ltd');
      request.flush({ Data: [customerFixture({ id: 3 })], Total: 1 });

      expect(store.searchTerm()).toBe('acme corp ltd');
      expect(store.records()).toHaveLength(1);
      expect(store.page()).toBe(1);
    });

    it('clears search via an empty term (reloads the full set)', async () => {
      const { store, http } = deployStore();

      store.search('');
      await delay(450);
      const request = http.expectOne((req) => req.url === READ_URL);
      expect(request.request.params.get('Text')).toBe('');
      request.flush({ Data: [], Total: 0 });
      expect(store.isEmptyResult()).toBe(true);
    });
  });

  describe('cancellation: the latest request wins', () => {
    it('rapid refreshes cancel stale in-flight requests without clearing loading', async () => {
      const { store, http } = deployStore();

      store.refresh(); // request A
      store.refresh(); // request B supersedes A
      expect(store.loading()).toBe(true);

      const pending = http.match((req) => req.url === READ_URL);
      expect(pending.length).toBe(2);
      // The stale request A was cancelled outright…
      expect(pending[0].cancelled).toBe(true);
      expect(pending[1].cancelled).toBe(false);
      // …and its cancellation must NOT clear the loading flag of request B.
      expect(store.loading()).toBe(true);

      // Only the latest response can reach the UI.
      pending[1].flush({ Data: [customerFixture({ id: 99 })], Total: 12 });
      expect(store.loading()).toBe(false);
      expect(store.records().map((r) => r.id)).toEqual([99]);
    });

    it('serves pagination instantly from the cache — zero network traffic', async () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne((req) => req.url === READ_URL)
        .flush({
          Data: Array.from({ length: 12 }, (_, i) => customerFixture({ id: i + 1 })),
          Total: 12,
        });

      store.setPage(2);
      store.setPage(3);

      // The matching set is cached; page changes must never re-request it.
      http.expectNone((req) => req.url === READ_URL);
      expect(store.loading()).toBe(false);
      expect(store.page()).toBe(3);
      // 12 records / pageSize 5 → page 3 holds the last 2 rows.
      expect(store.paginatedCustomers().map((r) => r.id)).toEqual([11, 12]);
    });
  });

  describe('in-memory cache (legacy API — one request per search term)', () => {
    it('serves repeated visits and identical reloads from the cache', async () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne((req) => req.url === READ_URL).flush({ Data: [customerFixture({ id: 1 })], Total: 9 });
      expect(store.records()).toHaveLength(1);

      // Re-visit with the identical query: deduped, no network.
      store.reload();
      http.expectNone((req) => req.url === READ_URL);
      expect(store.records()).toHaveLength(1);

      // A changed query for the SAME search term is served from the cache too.
      store.setPage(1);
      http.expectNone((req) => req.url === READ_URL);
      expect(store.loading()).toBe(false);
    });

    it('refetches when the cache entry has expired', async () => {
      const originalTtl = environment.customers.cacheTtlMs;
      environment.customers.cacheTtlMs = 20;
      try {
        const { store, http } = deployStore();

        store.reload();
        http.expectOne((req) => req.url === READ_URL).flush({ Data: [customerFixture({ id: 1 })], Total: 9 });

        await delay(30); // TTL elapsed

        store.reload();
        const request = http.expectOne((req) => req.url === READ_URL);
        request.flush({ Data: [customerFixture({ id: 2 })], Total: 1 });
        expect(store.records().map((r) => r.id)).toEqual([2]);
      } finally {
        environment.customers.cacheTtlMs = originalTtl;
      }
    });

    it('refresh() busts the cache and refetches from the network', async () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne((req) => req.url === READ_URL).flush({ Data: [customerFixture({ id: 1 })], Total: 9 });

      store.refresh();
      const request = http.expectOne((req) => req.url === READ_URL);
      expect(request.request.params.get('Text')).toBe('');
      request.flush({ Data: [customerFixture({ id: 2 })], Total: 1 });
      expect(store.records().map((r) => r.id)).toEqual([2]);
    });

    it('clears a stale error when a cached set is restored', async () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne((req) => req.url === READ_URL).flush({ Data: [customerFixture({ id: 1 })], Total: 9 });

      store.search('missing'); // cold term → network failure
      await delay(450);
      http
        .expectOne((req) => req.url === READ_URL)
        .flush(null, { status: 500, statusText: 'Server Error' });
      expect(store.error()).not.toBeNull();

      store.clearSearch(); // back to the cached term → served from cache
      await delay(450);
      http.expectNone((req) => req.url === READ_URL);
      expect(store.error()).toBeNull();
      expect(store.records().map((r) => r.id)).toEqual([1]);
    });
  });

  describe('query contract (legacy API — documented params only)', () => {
    it('hits the network once per search term; page/sort/filter changes reuse the cached set', async () => {
      const { store, http } = deployStore();

      store.search('john');
      store.setPageSize(50);
      // The immediate (non-debounced) page-size change produced one request.
      const initial = http.expectOne((req) => req.url === READ_URL);
      expect(initial.request.params.get('Text')).toBe('john');
      // The Postman collection documents exactly these three parameters.
      expect(initial.request.params.keys().sort()).toEqual(['Direction', 'InCT', 'Text']);
      initial.flush({
        Data: Array.from({ length: 120 }, (_, i) => customerFixture({ id: i + 1 })),
        Total: 120,
      });

      store.setPage(2);
      store.setSort('accountManagerName');
      store.setCategoricalFilter('clientTypeId', 12);
      store.setCategoricalFilter('countryId', 7);

      // All client-side state changes resolve against the cached 'john' set.
      http.expectNone((req) => req.url === READ_URL);
      expect(store.page()).toBe(1); // sorting + filters reset pagination
      // Client-side categorical filtering still works over the cached set:
      // fixtures have accountTypeId 12 but countryId 2 → the country filter
      // legitimately empties the result.
      expect(store.categoricalFilteredRecords()).toHaveLength(0);
      expect(store.totalPages()).toBe(1);

      store.clearCategoricalFilters();
      expect(store.categoricalFilteredRecords()).toHaveLength(120);
      expect(store.totalPages()).toBe(3); // 120 records / pageSize 50

      // The debounced search resolves against the cache as well.
      await delay(450);
      http.expectNone((req) => req.url === READ_URL);
    });
  });

  describe('text filters', () => {
    it('reloads immediately when a text filter changes', async () => {
      const { store, http } = deployStore();

      store.setTextFilter('name', 'acme');
      await delay(20);

      const request = http.expectOne((req) => req.url === READ_URL);
      // Only the search-box term goes into Text; per-field filters apply client-side.
      expect(request.request.params.get('Text')).toBe('');
      request.flush({ Data: [], Total: 0 });

      expect(store.textFilters().name).toBe('acme');
      expect(store.totalFilterCount()).toBe(1);
    });

    it('removing the filter value clears it and reloads', async () => {
      const { store, http } = deployStore();

      store.setTextFilter('name', '');
      await delay(20);
      const request = http.expectOne((req) => req.url === READ_URL);
      expect(request.request.params.get('Text')).toBe('');
      request.flush({ Data: [], Total: 0 });

      expect(store.textFilters().name).toBeUndefined();
      expect(store.hasFilters()).toBe(false);
    });

    it('narrows the loaded set client-side so matching rows are shown', () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne((req) => req.url === READ_URL)
        .flush({
          Data: [
            customerFixture({ id: 1, email: 'salma@example.com' }),
            customerFixture({ id: 2, email: 'other@example.com' }),
            customerFixture({ id: 3, email: 'salma2@example.com' }),
          ],
          Total: 3,
        });

      store.setTextFilter('email', 'salma');
      expect(store.filteredRecords().map((r) => r.id)).toEqual([1, 3]);
      expect(store.textFilters().email).toBe('salma');

      store.setTextFilter('email', '');
      expect(store.filteredRecords().map((r) => r.id)).toEqual([1, 2, 3]);
    });
  });

  describe('categorical filters (client-side over the loaded set)', () => {
    it('filters, sorts and paginates derived state from real records', async () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne((req) => req.url === READ_URL)
        .flush({
          Data: [
            customerFixture({ id: 1, accountTypeId: 12, cityId: 1 }),
            customerFixture({ id: 2, accountTypeId: 7, cityId: 2 }),
            customerFixture({ id: 3, accountTypeId: 12, cityId: 1 }),
          ],
          Total: 3,
        });

      store.setCategoricalFilter('clientTypeId', 12);
      expect(store.categoricalFilteredRecords().map((r) => r.id)).toEqual([1, 3]);

      store.setSort('id');
      store.setPage(1);
      expect(store.sortedRecords().map((r) => r.id)).toEqual([1, 3]);

      store.clearCategoricalFilters();
      store.setPageSize(2);
      expect(store.paginatedCustomers()).toHaveLength(2);
      expect(store.totalPages()).toBe(2);
      store.setPage(2);
      expect(store.paginatedCustomers().map((r) => r.id)).toEqual([3]);
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

    it('keeps selections across pagination and reconciles PrimeNG events', async () => {
      const { store, http } = deployStore();

      store.reload();
      http
        .expectOne((req) => req.url === READ_URL)
        .flush({
          Data: Array.from({ length: 12 }, (_, i) => customerFixture({ id: i + 1 })),
          Total: 12,
        });

      store.selectAction(actionFixture());
      expect(store.selectionEnabled()).toBe(true);

      store.setPageSize(5);
      store.syncSelection(store.paginatedCustomers().slice(0, 2));
      expect(store.selectedRecordsForAction().map((r) => r.id)).toEqual([1, 2]);

      store.setPage(2);
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
      // Columns follow the canonical catalog order; the override only
      // controls WHICH columns are shown, not their order.
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
      ]);
      expect(store.sortField()).toBe('code');
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

  describe('save flow', () => {
    it('saves, closes saving state and refreshes the list on success', async () => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne((req) => req.url === READ_URL).flush({ Data: [], Total: 0 });

      let saved = false;
      store.saveCustomer(store.createPayload()).subscribe({
        next: (result) => (saved = result.success),
        error: () => undefined,
      });

      expect(store.saving()).toBe(true);
      http
        .expectOne((req) => req.method === 'POST')
        .flush({
          Result: true,
          ErrorMessage: 'Saved Successfully || Id : 77',
        });
      expect(store.saving()).toBe(false);
      expect(saved).toBe(true);

      // Success triggers a fresh list fetch.
      http
        .expectOne((req) => req.url === READ_URL)
        .flush({ Data: [customerFixture({ id: 77 })], Total: 1 });
      expect(store.records().map((r) => r.id)).toEqual([77]);
      expect(store.saveError()).toBeNull();
    });

    it('keeps the dialog state and reports save failures', async () => {
      const { store, http } = deployStore();

      store.openCreateForm();
      store.saveCustomer(store.createPayload()).subscribe({ error: () => undefined });

      http
        .expectOne((req) => req.method === 'POST')
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

/** Flushes whatever read request is currently pending (returns no record set). */
function await_flush(http: HttpTestingController): void {
  const pending = http.match((req) => req.url === READ_URL);
  for (const request of pending) {
    request.flush({ Data: [], Total: 0 });
  }
}
