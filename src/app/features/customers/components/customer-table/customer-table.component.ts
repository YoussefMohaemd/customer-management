import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { CustomerRecord } from '@features/customers/models/customer.model';
import { CustomerSortField } from '@features/customers/models/customer-query.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerActionsMenuComponent } from '@features/customers/components/customer-actions-menu/customer-actions-menu.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

interface ColumnDef {
  field?: CustomerSortField;
  header: string;
  sortable: boolean;
}

const COLUMNS: readonly ColumnDef[] = [
  { field: 'id', header: 'ID', sortable: true },
  { field: 'code', header: 'Code', sortable: true },
  { field: 'commercialName', header: 'Name', sortable: true },
  { field: 'email', header: 'Email', sortable: true },
  { field: 'mobile', header: 'Mobile', sortable: true },
  { header: 'Client Type', sortable: false },
  { header: 'Account Manager', sortable: false },
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
 * intent through the store, and emits typed outputs for anything a parent
 * must orchestrate (e.g. delete confirmation). It never performs API calls
 * or owns business rules.
 */
@Component({
  selector: 'app-customer-table',
  imports: [TableModule, TagModule, CustomerActionsMenuComponent, EmptyStateComponent],
  templateUrl: './customer-table.component.html',
  styleUrl: './customer-table.component.scss',
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