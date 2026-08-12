import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { CustomerPayload } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerFormComponent } from '@features/customers/components/customer-form/customer-form.component';
import type { CustomerFormMode } from '@features/customers/components/customer-form/customer-form.component';

const DIALOG_TITLES: Record<CustomerFormMode, string> = {
  create: 'Add Customer',
  edit: 'Edit Customer',
  view: 'View Customer',
};

/**
 * Responsive modal shell for the shared customer form. Owns visibility,
 * header title, close semantics and the save workflow (toast + store.saveCustomer).
 */
@Component({
  selector: 'app-customer-form-dialog',
  imports: [DialogModule, CustomerFormComponent],
  templateUrl: './customer-form-dialog.component.html',
  styleUrl: './customer-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormDialogComponent {
  protected readonly store = inject(CustomerStore);
  private readonly messageService = inject(MessageService);

  protected readonly visible = this.store.formOpen;

  protected readonly mode = computed(() => this.store.formMode());
  protected readonly title = computed(() => DIALOG_TITLES[this.mode()]);
  protected readonly headerIcon = computed(() =>
    this.mode() === 'edit' ? 'pi-pencil' : this.mode() === 'view' ? 'pi-eye' : 'pi-user-plus',
  );
  protected readonly headerIconClass = computed(() => {
    const base = 'text-white';
    if (this.mode() === 'create') {
      return `${base} bg-gradient-to-br from-emerald-500 to-teal-600`;
    }
    if (this.mode() === 'edit') {
      return `${base} bg-gradient-to-br from-blue-500 to-indigo-600`;
    }
    return `${base} bg-gradient-to-br from-slate-500 to-slate-700`;
  });

  protected onSaved(payload: CustomerPayload): void {
    const successMessage =
      this.mode() === 'create' ? 'Customer created successfully.' : 'Customer updated successfully.';
    this.store.saveCustomer(payload).subscribe({
      next: (result) => {
        if (result.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: result.message || successMessage,
            life: 3000,
          });
          this.store.closeForm();
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Save failed',
            detail: result.message,
            life: 4500,
          });
        }
      },
      error: () => undefined,
    });
  }
}