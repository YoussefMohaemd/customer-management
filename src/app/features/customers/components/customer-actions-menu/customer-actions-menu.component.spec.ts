import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuItemCommandEvent } from 'primeng/api';

import { CustomerActionsMenuComponent } from '@features/customers/components/customer-actions-menu/customer-actions-menu.component';
import { customerFixture, provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerActionsMenuComponent', () => {
  let fixture: ComponentFixture<CustomerActionsMenuComponent>;
  let component: CustomerActionsMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerActionsMenuComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerActionsMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('customer', customerFixture({ id: 42, commercialName: 'Acme' }));
    fixture.detectChanges();
  });

  it('creates the menu', () => {
    expect(component).toBeTruthy();
  });

  it('builds a model with View, Edit and Delete wired to the callbacks', () => {
    const view = vi.fn();
    const edit = vi.fn();
    const deleteFn = vi.fn();
    fixture.componentRef.setInput('onView', view);
    fixture.componentRef.setInput('onEdit', edit);
    fixture.componentRef.setInput('onDelete', deleteFn);
    fixture.detectChanges();

    const model = component['menuModel']();
    const items = model[0].items ?? [];
    const labels = items.map((item) => (item as { label?: string }).label);
    expect(labels).toContain('View');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');

    items
      .find((item) => (item as { label?: string }).label === 'Edit')
      ?.['command']?.({
        originalEvent: new MouseEvent('click'),
      } as MenuItemCommandEvent);

    expect(edit).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it('marks unsupported entries as disabled', () => {
    const model = component['menuModel']();
    const items = model[0].items ?? [];
    const contacts = items.find((item) =>
      String((item as { label?: string }).label).startsWith('Contacts'),
    ) as { disabled?: boolean };

    expect(contacts.disabled).toBe(true);
  });
});
