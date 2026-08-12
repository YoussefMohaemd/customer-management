import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';

import { CustomerRecord } from '@features/customers/models/customer.model';

const UNAVAILABLE_ACTIONS: readonly { label: string; icon: string }[] = [
  { label: 'Change Status', icon: 'pi-sync' },
  { label: 'Location', icon: 'pi-map-marker' },
  { label: 'Attachment', icon: 'pi-paperclip' },
  { label: 'Sales Order', icon: 'pi-receipt' },
  { label: 'Follow-Up', icon: 'pi-comments' },
  { label: 'Log', icon: 'pi-list' },
  { label: 'NFC', icon: 'pi-mobile' },
  { label: 'Add Potential', icon: 'pi-plus-circle' },
  { label: 'Potential', icon: 'pi-chart-line' },
  { label: 'Contacts', icon: 'pi-address-book' }
];

/**
 * Row-level actions menu matching the assessment reference. Backend support
 * is only claimed where the provided API actually supports it: View, Edit and
 * a Delete placeholder. Every other entry is disabled and clearly marked.
 */
@Component({
  selector: 'app-customer-actions-menu',
  imports: [MenuModule],
  template: `
    <button
      type="button"
      (click)="menu.toggle($event)"
      class="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      [attr.aria-label]="'Actions for ' + customer().commercialName"
    >
      <i class="pi pi-ellipsis-v text-sm"></i>
    </button>
    <p-menu #menu [model]="menuModel()" popup="true" appendTo="body" styleClass="w-60" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerActionsMenuComponent {
  readonly customer = input.required<CustomerRecord>();
  readonly onView = input<(customer: CustomerRecord) => void>(() => undefined);
  readonly onEdit = input<(customer: CustomerRecord) => void>(() => undefined);
  readonly onDelete = input<(customer: CustomerRecord) => void>(() => undefined);

  protected readonly menuModel = computed<MenuItem[]>(() => {
    const customer = this.customer();
    return [
      {
        label: 'Actions',
        items: [
          { label: 'View', icon: 'pi-eye', command: () => this.onView()(customer) },
          { label: 'Edit', icon: 'pi-pencil', command: () => this.onEdit()(customer) },
          { label: 'Delete', icon: 'pi-trash', command: () => this.onDelete()(customer) },
          { separator: true },
          ...UNAVAILABLE_ACTIONS.map((action) => ({
            label: `${action.label} — not available in this assessment`,
            icon: action.icon,
            disabled: true
          }))
        ]
      }
    ];
  });
}