import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerFiltersComponent } from '@features/customers/components/customer-filters/customer-filters.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

/** Mirrors the toolbar: the panel only exists in the DOM while it is open. */
@Component({
  standalone: true,
  imports: [CustomerFiltersComponent],
  template: `@if (open()) { <app-customer-filters /> }`,
})
class FiltersHostComponent {
  readonly open = signal(false);
}

describe('CustomerFiltersComponent', () => {
  let fixture: ComponentFixture<FiltersHostComponent>;
  let store: CustomerStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltersHostComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(FiltersHostComponent);
    store = TestBed.inject(CustomerStore);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
  });

  function panelComponent(): CustomerFiltersComponent {
    const debug = fixture.debugElement.query(By.directive(CustomerFiltersComponent));
    expect(debug).toBeTruthy();
    return debug.componentInstance;
  }

  it('is only rendered while open', () => {
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeTruthy();

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeNull();
  });

  it('renders one input per selected filterable column', () => {
    const labels = [...fixture.nativeElement.querySelectorAll('.fp-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual([
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

    const textInputs = fixture.nativeElement.querySelectorAll('input.fp-text-input');
    expect(textInputs.length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('p-select').length).toBe(4);
  });

  it('stays in sync with the existing column dropdown', () => {
    store.setColumnVisible('email', false);
    store.setColumnVisible('city', false);
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll('.fp-label')].map(
      (el) => el.textContent,
    );
    expect(labels).not.toContain('Email');
    expect(labels).not.toContain('City');
    expect(labels).toContain('Name');

    store.setColumnVisible('email', true);
    fixture.detectChanges();
    expect(
      [...fixture.nativeElement.querySelectorAll('.fp-label')].map((el) => el.textContent),
    ).toContain('Email');
  });

  it('prunes a filter value when its column is deselected', () => {
    store.setTextFilter('email', 'acme@example.com');
    store.setCategoricalFilter('cityId', 1);

    store.setColumnVisible('email', false);
    store.setColumnVisible('city', false);

    expect(store.textFilters().email).toBeUndefined();
    expect(store.filters().cityId).toBeNull();
  });

  it('types a text value and flushes it to the store', () => {
    const input = fixture.nativeElement.querySelector('input.fp-text-input');
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(store.textFilters().id).toBe('42');
  });

  it('preserves entered values across close and reopen', () => {
    const input = fixture.nativeElement.querySelector('input.fp-text-input');
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const reopened = fixture.nativeElement.querySelector('input.fp-text-input');
    expect(reopened?.value).toBe('42');
  });

  it('routes categorical changes to the store', () => {
    panelComponent()['onCategoricalChange']('clientTypeId', 12);
    expect(store.filters().clientTypeId).toBe(12);
  });

  it('clears all filters without touching the column selection', () => {
    store.setTextFilter('name', 'acme');
    store.setCategoricalFilter('cityId', 1);
    fixture.detectChanges();

    panelComponent()['clearAll']();

    expect(store.textFilters().name).toBeUndefined();
    expect(store.filters().cityId).toBeNull();
    expect(store.isColumnVisible('commercialName')).toBe(true);
    expect(store.isColumnVisible('city')).toBe(true);
  });
});
