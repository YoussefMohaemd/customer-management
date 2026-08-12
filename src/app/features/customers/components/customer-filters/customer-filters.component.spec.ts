import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerFiltersComponent } from '@features/customers/components/customer-filters/customer-filters.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerFiltersComponent', () => {
  let fixture: ComponentFixture<CustomerFiltersComponent>;
  let store: CustomerStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerFiltersComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerFiltersComponent);
    store = TestBed.inject(CustomerStore);
    fixture.detectChanges();
  });

  it('creates the filters panel', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the filter toggle with the active filter counter', () => {
    store.setTextFilter('name', 'acme');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.filter-button');
    expect(button?.textContent).toContain('Filter');
    expect(button?.textContent).toContain('1');
  });

  it('syncs local values from the store when the panel opens', () => {
    store.textFilters.set({ code: '5-55' });
    fixture.componentInstance['onPanelOpen']();

    expect(fixture.componentInstance['values'].code).toBe('5-55');
  });

  it('clearing all filters resets local values', () => {
    store.textFilters.set({ name: 'x' });
    store.filters.set({ clientTypeId: 5, accountManagerId: null, cityId: null, countryId: null });
    fixture.componentInstance['onPanelOpen']();
    fixture.componentInstance['clearAll']();

    expect(fixture.componentInstance['values'].name).toBe('');
    expect(fixture.componentInstance['values'].clientTypeId).toBeUndefined();
  });

  it('routes text and categorical changes to the store', () => {
    fixture.componentInstance['onTextFilterChange']('mobile', '0100');
    expect(store.textFilters().mobile).toBe('0100');

    fixture.componentInstance['onCategoricalFilterChange']('clientTypeId', 12);
    expect(store.filters().clientTypeId).toBe(12);
  });
});