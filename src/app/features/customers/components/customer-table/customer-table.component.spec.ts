import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerTableComponent } from '@features/customers/components/customer-table/customer-table.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { customerFixture, provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerTableComponent', () => {
  let fixture: ComponentFixture<CustomerTableComponent>;
  let store: CustomerStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerTableComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerTableComponent);
    store = TestBed.inject(CustomerStore);
  });

  it('creates the table', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders customer records provided by the store', () => {
    store.records.set([
      customerFixture({
        id: 18811,
        code: '5-55',
        commercialName: 'sdaaaa',
        email: 'asd@s.com',
        mobile: '+971 222222',
        accountTypeName: 'Normal Tenant',
        accountManagerName: 'Hamada Emp',
        city: 'Abu Dhabi',
        country: 'United Arab Emirates',
      }),
      customerFixture({ id: 18810, code: '5-54', commercialName: 'salmakhaled' }),
    ]);
    store.paginatedCustomers();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const cells = fixture.nativeElement.querySelector('tbody').textContent ?? '';
    expect(cells).toContain('18811');
    expect(cells).toContain('5-55');
    expect(cells).toContain('sdaaaa');
    expect(cells).toContain('asd@s.com');
    expect(cells).toContain('Abu Dhabi');
    expect(cells).toContain('United Arab Emirates');
    expect(cells).toContain('Hamada Emp');
  });

  it('renders the empty state when no records are loaded', () => {
    store.records.set([]);
    fixture.detectChanges();

    expect(store.isEmptyResult()).toBe(true);
  });

  it('emits deleteRequested through the actions handler', () => {
    const customer = customerFixture({ id: 5, commercialName: 'Acme' });
    const emitted: { id: number }[] = [];
    fixture.componentInstance.deleteRequested.subscribe((value) => emitted.push(value));
    fixture.componentInstance['onDelete'](customer);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe(5);
  });
});
