import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { CustomerRecord } from '@features/customers/models/customer.model';
import { CustomerColumnDef } from '@features/customers/models/customer-column.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerActionsMenuComponent } from '@features/customers/components/customer-actions-menu/customer-actions-menu.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

type TagSeverity = 'info' | 'success' | 'warn' | 'danger' | 'secondary';

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
 * Fully dynamic: the header and body cells are generated from the store's
 * selected column metadata (`selectedColumnDefs`), which is driven by the
 * Columns dropdown. Headers are plain visual headers — they never trigger
 * filtering or sorting; all filtering flows through the Filter panel.
 *
 * Pure view: consumes signals from the store and emits typed outputs for
 * anything a parent must orchestrate (e.g. delete confirmation).
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

  protected readonly colspan = computed(() => this.store.selectedColumnDefs().length + 1);

  protected readonly onView = (customer: CustomerRecord): void => this.store.openViewForm(customer);
  protected readonly onEdit = (customer: CustomerRecord): void => this.store.openEditForm(customer);
  protected readonly onDelete = (customer: CustomerRecord): void =>
    this.deleteRequested.emit(customer);

  protected cellValue(customer: CustomerRecord, column: CustomerColumnDef): string | number | null {
    const value = customer[column.field];
    return (value ?? '').toString().trim() ? (value as string | number) : null;
  }

  /** Tag cells always render a string label. */
  protected tagValue(customer: CustomerRecord, column: CustomerColumnDef): string | undefined {
    const value = this.cellValue(customer, column);
    return value === null ? undefined : String(value);
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

  protected tagSeverity(customer: CustomerRecord, column: CustomerColumnDef): TagSeverity {
    if (column.field === 'accountTypeName') {
      const hasLabel = (customer.accountTypeName ?? '').trim().length > 0;
      return this.typeSeverity(customer.accountTypeId, hasLabel);
    }
    const status = customer.status;
    if (status === null || status === '') {
      return 'secondary';
    }
    const normalized = status.toLowerCase();
    if (normalized.includes('active') || normalized.includes('enabled')) {
      return 'success';
    }
    if (normalized.includes('inactive') || normalized.includes('suspended')) {
      return 'secondary';
    }
    return 'info';
  }

  private typeSeverity(typeId: number | null, hasLabel: boolean): TagSeverity {
    if (typeId === null || !hasLabel) {
      return 'secondary';
    }
    return TYPE_SEVERITIES[typeId % TYPE_SEVERITIES.length];
  }
}
