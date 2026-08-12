import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { CustomerRecord } from '@features/customers/models/customer.model';
import { CustomerSortField } from '@features/customers/models/customer-query.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerActionsMenuComponent } from '@features/customers/components/customer-actions-menu/customer-actions-menu.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

interface ColumnDef {
  field: CustomerSortField;
  header: string;
  sortable: boolean;
}

const COLUMNS: readonly ColumnDef[] = [
  { field: 'id', header: 'ID', sortable: true },
  { field: 'code', header: 'Code', sortable: true },
  { field: 'commercialName', header: 'Name', sortable: true },
  { field: 'email', header: 'Email', sortable: true },
  { field: 'mobile', header: 'Mobile', sortable: true },
  { field: 'id', header: 'Client Type', sortable: false },
  { field: 'id', header: 'Account Manager', sortable: false },
  { field: 'city', header: 'City', sortable: true },
  { field: 'country', header: 'Country', sortable: true },
];

const TYPE_SEVERITIES: readonly ('info' | 'success' | 'warn' | 'danger')[] = [
  'info',
  'success',
  'warn',
  'danger',
];
const AVATAR_PALETTE: readonly string[] = [
  '#2563eb',
  '#7c3aed',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
];

/**
 * PrimeNG data grid for the customer page.
 *
 * Pure view: consumes signals from the store, delegates sorting and dialog
 * intent through the shared store/factory inputs, emits typed outputs for
 * anything a parent must orchestrate (e.g. delete confirmation). It never
 * performs API calls or owns business rules.
 */
@Component({
  selector: 'app-customer-table',
  imports: [TableModule, TagModule, CustomerActionsMenuComponent, EmptyStateComponent],
  template: `
    <p-table
      [value]="store.paginatedCustomers()"
      [loading]="store.loading()"
      [scrollable]="true"
      dataKey="id"
      styleClass="p-datatable-sm customer-datatable"
      [tableStyle]="{ 'min-width': '900px' }"
      [rowHover]="true"
    >
      <ng-template pTemplate="header">
        <tr>
          @for (column of COLUMNS; track $index) {
            <th [class]="column.sortable ? 'sortable' : ''">
              @if (column.sortable) {
                <button
                  type="button"
                  (click)="store.setSort(column.field)"
                  class="flex w-full items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  [attr.aria-label]="'Sort by ' + column.header"
                >
                  {{ column.header }}
                  <i [class]="sortIcon(column.field)" class="pi text-[10px]" aria-hidden="true"></i>
                </button>
              } @else {
                {{ column.header }}
              }
            </th>
          }
          <th class="w-24 text-right">Actions</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-customer let-rowIndex="rowIndex">
        <tr [attr.aria-rowindex]="rowIndex + 1" class="group">
          <td class="font-medium text-slate-500">{{ customer.id || '—' }}</td>
          <td>
            <span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
              {{ customer.code || '—' }}
            </span>
          </td>
          <td>
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                [style.background]="avatarColor(customer.id)"
                aria-hidden="true"
              >
                {{ initials(customer) }}
              </div>
              <div class="min-w-0 leading-tight">
                <div class="truncate text-sm font-medium text-slate-800">
                  {{ customer.commercialName || '—' }}
                </div>
                @if (customer.nameAr) {
                  <div class="truncate text-xs text-slate-400" dir="rtl">{{ customer.nameAr }}</div>
                }
              </div>
            </div>
          </td>
          <td>
            @if (customer.email) {
              <a
                [href]="'mailto:' + customer.email"
                class="text-sm text-blue-600 hover:underline"
                >{{ customer.email }}</a
              >
            } @else {
              <span class="text-sm text-slate-300">—</span>
            }
          </td>
          <td>
            <span class="text-sm text-slate-600" dir="ltr">{{ customer.mobile || '—' }}</span>
          </td>
          <td>
            <p-tag
              [value]="customer.accountTypeId ? 'Type ' + customer.accountTypeId : '—'"
              [severity]="typeSeverity(customer.accountTypeId)"
            />
          </td>
          <td>
            <span class="text-sm text-slate-600">{{
              customer.accountManagerId ? 'AM #' + customer.accountManagerId : '—'
            }}</span>
          </td>
          <td class="text-sm text-slate-600">{{ customer.city || '—' }}</td>
          <td class="text-sm text-slate-600">{{ customer.country || '—' }}</td>
          <td class="text-right">
            <app-customer-actions-menu
              [customer]="customer"
              [onView]="onView"
              [onEdit]="onEdit"
              [onDelete]="onDelete"
            />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptydata">
        <tr>
          <td colspan="11" class="!p-0">
            <app-empty-state
              icon="pi-inbox"
              title="No customers found"
              description="Try changing your search or filter criteria."
            />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="loadingbody">
        <tr>
          <td colspan="11">
            <div class="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <i class="pi pi-spin pi-spinner text-base" aria-hidden="true"></i>
              Loading customers…
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerTableComponent {
  protected readonly store = inject(CustomerStore);

  readonly deleteRequested = output<CustomerRecord>();

  protected readonly COLUMNS = COLUMNS;

  protected readonly onView = (customer: CustomerRecord): void => this.store.openViewForm(customer);
  protected readonly onEdit = (customer: CustomerRecord): void => this.store.openEditForm(customer);
  protected readonly onDelete = (customer: CustomerRecord): void =>
    this.deleteRequested.emit(customer);

  protected sortIcon(field: CustomerSortField): string {
    if (this.store.sortField() !== field) {
      return 'pi-sort-alt';
    }
    return this.store.sortDirection() === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down';
  }

  protected initials(customer: CustomerRecord): string {
    const name = customer.commercialName.trim();
    if (!name) {
      return '?';
    }
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }

  protected avatarColor(id: number): string {
    return AVATAR_PALETTE[id % AVATAR_PALETTE.length];
  }

  protected typeSeverity(
    typeId: number | null,
  ): 'info' | 'success' | 'warn' | 'danger' | 'secondary' {
    if (typeId === null) {
      return 'secondary';
    }
    return TYPE_SEVERITIES[typeId % TYPE_SEVERITIES.length];
  }
}
