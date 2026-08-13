import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerToolbarComponent } from '@features/customers/components/customer-toolbar/customer-toolbar.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerToolbarComponent', () => {
  let fixture: ComponentFixture<CustomerToolbarComponent>;
  let store: CustomerStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerToolbarComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerToolbarComponent);
    store = TestBed.inject(CustomerStore);
    fixture.componentRef.setInput('searchValue', '');
    fixture.detectChanges();
  });

  it('creates the toolbar', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('emits search changes as the user types', () => {
    const emitted: string[] = [];
    fixture.componentInstance.searchChange.subscribe((value) => emitted.push(value));

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'salma';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['salma']);
  });

  it('emits searchCleared when the clear button is used', () => {
    fixture.componentRef.setInput('searchValue', 'salma');
    fixture.detectChanges();

    let cleared = 0;
    fixture.componentInstance.searchCleared.subscribe(() => (cleared += 1));

    const clearButton = fixture.nativeElement.querySelector('button[aria-label="Clear search"]');
    clearButton?.click();

    expect(cleared).toBe(1);
  });

  it('shows a chip per active filter value and removes it on demand', () => {
    store.setTextFilter('name', 'acme');
    store.setCategoricalFilter('cityId', 1);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Name: acme');
    expect(fixture.nativeElement.textContent).toContain('City: 1');

    // Removing the chip clears the value; no server call is needed for the
    // chip to disappear because chips are derived from the filter state.
    const removeButtons = fixture.nativeElement.querySelectorAll('button[aria-label^="Remove"]');
    removeButtons[0]?.click();
    fixture.detectChanges();

    expect(store.textFilters().name).toBeUndefined();
    expect(store.filters().cityId).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('Name: acme');
    expect(fixture.nativeElement.textContent).toContain('City: 1');
  });

  it('shows the raw value on a categorical chip when options are not loaded', () => {
    store.setCategoricalFilter('clientTypeId', 7);
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.filter-chip');
    expect(chip?.textContent).toContain('Client Type');
    expect(chip?.textContent).toContain('7');
  });

  it('shows the active filter counter on the Filter button', () => {
    store.setTextFilter('name', 'acme');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.filter-button');
    expect(button?.textContent).toContain('Filter');
    expect(button?.textContent).toContain('1');
  });

  it('opens the filter panel below the toolbar row without moving the dropdown', () => {
    const row = fixture.nativeElement.querySelector('.toolbar-row');

    const filterButton = fixture.nativeElement.querySelector('button.filter-button');
    filterButton?.click();
    fixture.detectChanges();

    // Panel is rendered as a separate block UNDERNEATH the whole toolbar row.
    const panel = fixture.nativeElement.querySelector('.filter-panel');
    expect(panel).toBeTruthy();
    expect(row?.querySelector('.filter-panel')).toBeNull();

    // Search + Filter + existing column dropdown stay together on the row.
    expect(row?.querySelector('input.search-input')).toBeTruthy();
    expect(row?.querySelector('button.filter-button')).toBeTruthy();
    expect(row?.querySelector('app-customer-column-picker')).toBeTruthy();
    // No duplicate dropdown and no duplicate Filter button when the panel is open.
    expect(fixture.nativeElement.querySelectorAll('app-customer-column-picker').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('button.filter-button').length).toBe(1);
  });

  it('closes the filter panel on the second click', () => {
    const filterButton = fixture.nativeElement.querySelector('button.filter-button');
    filterButton?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeTruthy();

    filterButton?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeNull();
    // The row keeps all three controls after closing.
    const row = fixture.nativeElement.querySelector('.toolbar-row');
    expect(row?.querySelector('input.search-input')).toBeTruthy();
    expect(row?.querySelector('button.filter-button')).toBeTruthy();
    expect(row?.querySelector('app-customer-column-picker')).toBeTruthy();
  });

  it('derives the filter inputs from the current column dropdown selection', () => {
    fixture.nativeElement.querySelector('button.filter-button')?.click();
    fixture.detectChanges();

    const labels = () =>
      [...fixture.nativeElement.querySelectorAll('.fp-label')].map((el) => el.textContent);

    // Default selection: every default-visible filterable column.
    expect(labels()).toEqual([
      'ID',
      'Code',
      'Name',
      'Email',
      'Mobile',
      'Client Type',
      'Account Manager',
      'City',
      'Country',
    ]);

    // Simulate the column dropdown: hide Email + City, show no others.
    store.setColumnVisible('email', false);
    store.setColumnVisible('city', false);
    fixture.detectChanges();
    expect(labels()).not.toContain('Email');
    expect(labels()).not.toContain('City');

    // Re-select Email from the same dropdown state.
    store.setColumnVisible('email', true);
    fixture.detectChanges();
    expect(labels()).toContain('Email');
  });
});