import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerColumnPickerComponent } from '@features/customers/components/customer-column-picker/customer-column-picker.component';
import {
  CustomerColumnDef,
  CustomerFieldKey,
} from '@features/customers/models/customer-column.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

type PickerTestHarness = {
  onSearchInput: (event: Event) => void;
  toggleOption: (field: CustomerFieldKey) => void;
  filteredColumnDefs: () => CustomerColumnDef[];
};

describe('CustomerColumnPickerComponent', () => {
  let fixture: ComponentFixture<CustomerColumnPickerComponent>;
  let store: CustomerStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerColumnPickerComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerColumnPickerComponent);
    store = TestBed.inject(CustomerStore);
    fixture.detectChanges();
  });

  it('creates the picker', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a chip for every visible column without a X/Y counter', () => {
    const control = fixture.nativeElement.querySelector('.column-control');
    expect(control).toBeTruthy();
    expect(control.querySelector('.column-count')).toBeNull();
    expect(Array.from(control.querySelectorAll('.column-chip')).length).toBe(
      store.visibleColumnCount(),
    );
  });

  it('renders each chip with its label and a remove button', () => {
    const chips = fixture.nativeElement.querySelectorAll('.column-chip');
    const first = chips[0];
    expect(first.querySelector('.column-chip-label')?.textContent).toBe('ID');
    expect(first.querySelector('.column-chip-remove')).toBeTruthy();
  });

  it('removes a column when its chip X is clicked', () => {
    const before = store.visibleColumnCount();
    fixture.nativeElement
      .querySelector('.column-chip-remove')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(store.visibleColumnCount()).toBe(before - 1);
    expect(store.isColumnVisible('id')).toBe(false);
  });

  it('disables the remove button on the last remaining column', () => {
    for (const column of store.allColumnDefs()) {
      if (store.visibleColumnCount() > 1) {
        store.setColumnVisible(column.field, false);
      }
    }
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.column-chip');
    expect(chip.querySelector('.column-chip-remove')?.disabled).toBe(true);
  });

  it('toggles columns on and off through the store', () => {
    const visibleBefore = store.visibleColumnCount();
    store.setColumnVisible('city', false);
    expect(store.visibleColumnCount()).toBe(visibleBefore - 1);
    expect(store.isColumnVisible('city')).toBe(false);

    store.setColumnVisible('city', true);
    expect(store.isColumnVisible('city')).toBe(true);
  });

  it('keeps at least one column visible', () => {
    for (const column of store.allColumnDefs()) {
      store.setColumnVisible(column.field, false);
    }
    expect(store.visibleColumnCount()).toBe(1);
  });

  it('resets to the default selection', () => {
    store.setColumnVisible('city', false);
    store.setColumnVisible('country', false);
    store.resetColumns();
    expect(store.visibleColumnCount()).toBeGreaterThan(0);
    expect(store.isColumnVisible('city')).toBe(true);
    expect(store.isColumnVisible('country')).toBe(true);
  });

  it('filters the field list client-side while typing', () => {
    const component = fixture.componentInstance as unknown as PickerTestHarness;
    const handler = (value: string): void =>
      component.onSearchInput({ target: { value } } as unknown as Event);

    handler('name');
    const labels = component.filteredColumnDefs().map((column) => column.label);
    expect(labels).toContain('Name');
    expect(labels).toContain('English Name');
    expect(labels).toContain('Arabic Name');
    expect(labels).not.toContain('ID');
    expect(labels).not.toContain('Email');
  });

  it('clearing the search restores the complete field list', () => {
    const component = fixture.componentInstance as unknown as PickerTestHarness;
    component.onSearchInput({ target: { value: 'city' } } as unknown as Event);
    expect(component.filteredColumnDefs().map((column) => column.label)).toEqual(['City']);

    component.onSearchInput({ target: { value: '' } } as unknown as Event);
    expect(component.filteredColumnDefs().length).toBe(store.allColumnDefs().length);
  });

  it('selecting a filtered field updates the table columns without a reload', () => {
    const component = fixture.componentInstance as unknown as PickerTestHarness;
    store.setColumnVisible('city', false);
    component.onSearchInput({ target: { value: 'city' } } as unknown as Event);
    const city = component.filteredColumnDefs().find((column) => column.field === 'city')!;
    component.toggleOption(city.field);
    fixture.detectChanges();

    expect(store.isColumnVisible('city')).toBe(true);
    expect(store.selectedColumnDefs().some((column) => column.field === 'city')).toBe(true);
    expect(store.filterableColumnDefs().some((column) => column.field === 'city')).toBe(true);
  });
});
