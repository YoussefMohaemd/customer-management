import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerFiltersComponent } from '@features/customers/components/customer-filters/customer-filters.component';
import { CustomerColumnPickerComponent } from '@features/customers/components/customer-column-picker/customer-column-picker.component';
import {
  CustomerFilterKey,
  CustomerTextFilterKey,
  isTextFilterKey,
} from '@features/customers/models/customer-query.model';

interface FilterChip {
  key: CustomerTextFilterKey | CustomerFilterKey;
  label: string;
  value: string;
}

/**
 * Search + filter strip above the table. Presentational: raw search values
 * are emitted through `searchChange` — the debounce/cancel pipeline lives in
 * the store. The filters panel is self-contained.
 */
@Component({
  selector: 'app-customer-toolbar',
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
    CustomerFiltersComponent,
    CustomerColumnPickerComponent,
  ],
  templateUrl: './customer-toolbar.component.html',
  styleUrl: './customer-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerToolbarComponent {
  readonly searchValue = input('');
  readonly searchChange = output<string>();
  readonly searchCleared = output<void>();

  protected readonly store = inject(CustomerStore);

  /** Whether the filter panel (rendered below the toolbar row) is open. */
  protected readonly filtersPanelOpen = signal(false);

  /** One chip per active filter value — derived, never duplicated state. */
  protected readonly activeChips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    for (const column of this.store.filterableColumnDefs()) {
      const filter = column.filter!;
      const key = filter.key;
      let val = '';
      if (isTextFilterKey(key)) {
        val = this.store.textFilters()[key] ?? '';
      } else {
        val = this.categoricalLabel(key as CustomerFilterKey);
      }
      if (val.trim()) {
        chips.push({
          key,
          label: column.label,
          value: val,
        });
      }
    }
    return chips;
  });

  protected onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  protected clearSearch(): void {
    this.searchCleared.emit();
  }

  protected toggleFiltersPanel(): void {
    this.filtersPanelOpen.update((open) => !open);
  }

  /** Removes a chip: clears its filter value. */
  protected removeChip(key: CustomerTextFilterKey | CustomerFilterKey): void {
    if (isTextFilterKey(key)) {
      if ((this.store.textFilters()[key] ?? '').trim()) {
        this.store.setTextFilter(key, '');
      }
    } else if (this.store.filters()[key] !== null) {
      this.store.setCategoricalFilter(key, null);
    }
  }

  private categoricalLabel(key: CustomerFilterKey): string {
    const value = this.store.filters()[key];
    if (value === null) {
      return '';
    }
    const options = {
      clientTypeId: this.store.clientTypeOptions(),
      accountManagerId: this.store.accountManagerOptions(),
      cityId: this.store.cityOptions(),
      countryId: this.store.countryOptions(),
    }[key];
    return options.find((option) => option.value === value)?.label ?? String(value);
  }
}
