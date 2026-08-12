import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerPageComponent } from '@features/customers/components/customer-page/customer-page.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerPageComponent', () => {
  let fixture: ComponentFixture<CustomerPageComponent>;
  let store: CustomerStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerPageComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerPageComponent);
    store = TestBed.inject(CustomerStore);
  });

  it('creates the page and triggers the initial server load', () => {
    const reloadSpy = vi.spyOn(store, 'reload');
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('renders the page heading and the Add Customer action', () => {
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Customers');
    expect(fixture.nativeElement.querySelector('[aria-label]')?.textContent ?? '').toBeDefined();
  });

  it('renders the Actions and Reports sections', () => {
    fixture.detectChanges();

    const sections = fixture.nativeElement.querySelectorAll('section');
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });
});
