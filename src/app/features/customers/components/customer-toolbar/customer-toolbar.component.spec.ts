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

  it('shows active filter chips and removes them on demand', () => {
    store.textFilters.set({ name: 'acme' });
    store.filters.set({ clientTypeId: null, accountManagerId: null, cityId: 1, countryId: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Active filters');
    expect(fixture.nativeElement.textContent).toContain('Name: acme');

    // Removing the chip calls the store synchronously without a server call
    // being required for the chip to disappear.
    const removeButtons = fixture.nativeElement.querySelectorAll('button[aria-label^="Remove"]');
    removeButtons[0]?.click();
    fixture.detectChanges();
    expect(store.textFilters().name).toBeUndefined();
    expect(fixture.nativeElement.textContent).not.toContain('Name: acme');
  });
});