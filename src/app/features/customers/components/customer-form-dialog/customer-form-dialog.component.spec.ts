import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerFormDialogComponent } from '@features/customers/components/customer-form-dialog/customer-form-dialog.component';
import { CustomerStore } from '@features/customers/state/customer.store';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerFormDialogComponent', () => {
  let fixture: ComponentFixture<CustomerFormDialogComponent>;
  let store: CustomerStore;
  let http: HttpTestingController;
  let messageService: MessageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerFormDialogComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerFormDialogComponent);
    store = TestBed.inject(CustomerStore);
    http = TestBed.inject(HttpTestingController);
    messageService = TestBed.inject(MessageService);
    fixture.detectChanges();
  });

  it('creates the dialog', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the documented title for create mode', () => {
    store.openCreateForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Add Customer');
  });

  it('saves, toasts success and closes the dialog', async () => {
    const addSpy = vi.spyOn(messageService, 'add');
    store.openCreateForm();
    fixture.detectChanges();

    fixture.componentInstance['onSaved']({ ...store.createPayload() });

    const request = http.expectOne((req) => req.method === 'POST');
    request.flush({
      Result: true,
      ErrorMessage: 'Saved Successfully || Customer Code:NEW ,  Id : 200',
    });

    expect(store.formOpen()).toBe(false);
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Saved' }),
    );
  });

  it('keeps the dialog open and toasts an error when the server rejects', async () => {
    const addSpy = vi.spyOn(messageService, 'add');
    store.openCreateForm();
    fixture.detectChanges();

    fixture.componentInstance['onSaved']({ ...store.createPayload() });

    http.expectOne((req) => req.method === 'POST').flush({
      Result: false,
      ErrorMessage: 'Sorry,Mobile already Exist.',
    });

    expect(store.formOpen()).toBe(true);
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Save failed' }),
    );
  });
});