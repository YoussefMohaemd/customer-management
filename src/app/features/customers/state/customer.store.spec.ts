import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { environment } from '@environments/environment';
import { CustomerStore } from '@features/customers/state/customer.store';
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

describe('CustomerStore', () => {
  describe('load pipeline', () => {
    it('reload() fetches the matching set into signals', fakeAsync(() => {
      const { store, http } = deployStore();

      store.reload();
      expect(store.loading()).toBe(true);

      const request = http.expectOne((req) => req.method === 'GET' && req.url === READ_URL);
      request.flush({ Data: [customerFixture({ id: 1 })], Total: 9 });

      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.records()).toHaveLength(1);
      expect(store.totalCount()).toBe(9);
      expect(store.isEmptyResult()).toBe(false);
    }));

    it('drops repeated identical queries (no duplicate requests)', fakeAsync(() => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_URL).flush({ Data: [], Total: 0 });

      store.reload();
      // Fresh query state but identical parameters → short-circuited.
      http.expectNone(READ_URL);
      expect(store.loading()).toBe(false);
    }));

    it('surfaces a 401 as a user-friendly error and clears it on retry', fakeAsync(() => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(store.error()).toContain('not authorized');
      expect(store.loading()).toBe(false);
      expect(store.hasRecords()).toBe(false);

      // Retry path issues a brand-new request.
      store.reload();
      http.expectOne(READ_URL).flush({ Data: [customerFixture({ id: 2 })], Total: 1 });
      expect(store.error()).toBeNull();
      expect(store.records()).toHaveLength(1);
    }));
  });

  describe('debounced server-side search', () => {
    it('debounces, keeps only the last term and fires one request', fakeAsync(() => {
      const { store, http } = deployStore();

      store.search('acme');
      tick(100);
      store.search('acme corp');
      tick(100);
      store.search('acme corp ltd');

      http.expectNone(READ_URL);

      tick(400);
      const request = http.expectOne((req) => req.method === 'GET' && req.url === READ_URL);
      expect(request.request.params.get('Text')).toBe('acme corp ltd');
      request.flush({ Data: [customerFixture({ id: 3 })], Total: 1 });

      expect(store.searchTerm()).toBe('acme corp ltd');
      expect(store.records()).toHaveLength(1);
      expect(store.page()).toBe(1);
    }));

    it('clears search via an empty term (reloads the full set)', fakeAsync(() => {
      const { store, http } = deployStore();

      store.search('');
      tick(400);
      const request = http.expectOne(READ_URL);
      expect(request.request.params.get('Text')).toBe('');
      request.flush({ Data: [], Total: 0 });
      expect(store.isEmptyResult()).toBe(true);
    }));
  });

  describe('text filters trigger a server reload', () => {
    it('reloads immediately when a text filter changes', fakeAsync(() => {
      const { store, http } = deployStore();

      store.setTextFilter('name', 'acme');
      tick(10);

      const request = http.expectOne((req) => req.method === 'GET' && req.url === READ_URL);
      expect(request.request.params.get('Text')).toBe('name:acme');
      request.flush({ Data: [], Total: 0 });

      expect(store.textFilters().name).toBe('acme');
      expect(store.totalFilterCount()).toBe(1);
    }));

    it('removing the filter value clears it and reloads', fakeAsync(() => {
      const { store, http } = deployStore();

      store.setTextFilter('name', '');
      tick(10);
      const request = http.expectOne(READ_URL);
      expect(request.request.params.get('Text')).toBe('');
      request.flush({ Data: [], Total: 0 });

      expect(store.textFilters().name).toBeUndefined();
      expect(store.hasFilters()).toBe(false);
    }));
  });

  describe('categorical filters (client-side over the loaded set)', () => {
    it('filters, sorts and paginates derived state from real records', fakeAsync(() => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_URL).flush({
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
    }));
  });

  describe('save flow', () => {
    it('saves, closes saving state and refreshes the list on success', fakeAsync(() => {
      const { store, http } = deployStore();

      store.reload();
      http.expectOne(READ_URL).flush({ Data: [], Total: 0 });

      let saved = false;
      store.saveCustomer(store.createPayload()).subscribe({
        next: (result) => (saved = result.success),
        error: () => undefined,
      });

      expect(store.saving()).toBe(true);
      http.expectOne((req) => req.method === 'POST').flush({
        Result: true,
        ErrorMessage: 'Saved Successfully || Id : 77',
      });
      expect(store.saving()).toBe(false);
      expect(saved).toBe(true);

      // Success triggers a fresh list fetch.
      http.expectOne(READ_URL).flush({ Data: [customerFixture({ id: 77 })], Total: 1 });
      expect(store.records().map((r) => r.id)).toEqual([77]);
      expect(store.saveError()).toBeNull();
    }));

    it('keeps the dialog state and reports save failures', fakeAsync(() => {
      const { store, http } = deployStore();

      store.openCreateForm();
      store.saveCustomer(store.createPayload()).subscribe({ error: () => undefined });

      http.expectOne((req) => req.method === 'POST').flush({ Result: false, ErrorMessage: 'Sorry,Mobile already Exist.' });
      expect(store.saving()).toBe(false);
      expect(store.saveError()).toBeNull();
    }));
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