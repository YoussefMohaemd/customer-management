import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { CustomerPayload } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import {
  CustomerFormComponent,
  CustomerFormMode
} from '@features/customers/components/customer-form/customer-form.component';

const DIALOG_TITLES: Record<CustomerFormMode, string> = {
  create: 'Add Customer',
  edit: 'Edit Customer',
  view: 'View Customer'
};

/**
 * Responsive modal shell for the shared customer form. Owns visibility,
 * header title, close semantics and the save workflow (toast + store.saveCustomer).
 */
@Component({
  selector: 'app-customer-form-dialog',
  imports: [DialogModule, CustomerFormComponent],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [closable]="false"
      [dismissableMask]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: 'min(94vw, 1120px)' }"
      [contentStyle]="{ overflow: 'auto', maxHeight: 'min(88vh, 900px)' }"
      [styleClass]="'customer-dialog'"
      [breakpoints]="{ '1366px': { width: '96vw' }, '768px': { width: '98vw' } }"
      (onHide)="store.closeForm()"
      [attr.aria-label]="title"
    >
      <ng-template pTemplate="header">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg"
            [class]="headerIconClass"
            aria-hidden="true"
          >
            <i [class]="headerIcon" class="pi text-base"></i>
          </div>
          <div>
            <h2 class="text-base font-bold text-slate-800">{{ title }}</h2>
            @if (mode === 'edit' && store.formCustomer()) {
              <p class="text-xs text-slate-400">ID #{{ store.formCustomer()!.id }}</p>
            }
          </div>
        </div>
      </ng-template>

      <app-customer-form
        [mode]="mode"
        [initial]="store.formCustomer()"
        (saved)="onSaved($event)"
        (cancelled)="store.closeForm()"
      />
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerFormDialogComponent {
  protected readonly store = inject(CustomerStore);
  private readonly messageService = inject(MessageService);

  protected readonly visible = this.store.formOpen;

  protected get mode(): CustomerFormMode {
    return this.store.formMode();
  }

  protected get title(): string {
    return DIALOG_TITLES[this.mode];
  }

  protected get headerIcon(): string {
    return this.mode === 'edit' ? 'pi-pencil' : this.mode === 'view' ? 'pi-eye' : 'pi-user-plus';
  }

  protected get headerIconClass(): string {
    const base = 'text-white';
    if (this.mode === 'create') {
      return `${base} bg-gradient-to-br from-emerald-500 to-teal-600`;
    }
    if (this.mode === 'edit') {
      return `${base} bg-gradient-to-br from-blue-500 to-indigo-600`;
    }
    return `${base} bg-gradient-to-br from-slate-500 to-slate-700`;
  }

  protected onSaved(payload: CustomerPayload): void {
    const successMessage = this.mode === 'create' ? 'Customer created successfully.' : 'Customer updated successfully.';
    this.store.saveCustomer(payload).subscribe({
      next: (result) => {
        if (result.success) {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: result.message || successMessage, life: 3000 });
          this.store.closeForm();
        } else {
          this.messageService.add({ severity: 'error', summary: 'Save failed', detail: result.message, life: 4500 });
        }
      },
      error: () => undefined
    });
  }
}