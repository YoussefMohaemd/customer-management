import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PopoverModule } from 'primeng/popover';

import { CustomerFieldKey } from '@features/customers/models/customer-column.model';
import { CustomerStore } from '@features/customers/state/customer.store';

/**
 * Columns dropdown (far right of the toolbar).
 *
 * Lists every API-returned field; checking/unchecking entries immediately
 * shows/hides the matching table column. At least one column must remain
 * visible. The table header and body are regenerated from the store's
 * selected column metadata — no page reload is involved.
 */
@Component({
  selector: 'app-customer-column-picker',
  imports: [PopoverModule],
  templateUrl: './customer-column-picker.component.html',
  styleUrl: './customer-column-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerColumnPickerComponent {
  protected readonly store = inject(CustomerStore);

  protected popoverOpen = false;

  protected toggle(field: CustomerFieldKey, checked: boolean): void {
    this.store.setColumnVisible(field, checked);
  }

  /** The last visible column cannot be unchecked. */
  protected isLastVisible(field: CustomerFieldKey): boolean {
    return this.store.visibleColumnCount() === 1 && this.store.isColumnVisible(field);
  }

  protected reset(): void {
    this.store.resetColumns();
  }
}
