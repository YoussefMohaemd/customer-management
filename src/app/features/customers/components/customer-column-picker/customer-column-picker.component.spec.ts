import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerColumnPickerComponent } from '@features/customers/components/customer-column-picker/customer-column-picker.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

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

  it('renders the toggle with the visible/total count', () => {
    const button = fixture.nativeElement.querySelector('.column-button');
    expect(button?.textContent).toContain('Columns');
    expect(button?.textContent).toContain(
      `${store.visibleColumnCount()}/${store.allColumnDefs().length}`,
    );
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
});
