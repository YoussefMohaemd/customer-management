import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
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
} from '@features/customers/models/customer-query.model';

interface FilterChip {
  key: CustomerTextFilterKey | CustomerFilterKey;
  label: string;
  value: string;
}

const TEXT_FILTER_LABELS: Record<CustomerTextFilterKey, string> = {
  id: 'ID',
  code: 'Code',
  name: 'Name',
  email: 'Email',
  mobile: 'Mobile',
};

const CATEGORICAL_FILTER_LABELS: Record<CustomerFilterKey, string> = {
  clientTypeId: 'Client Type',
  accountManagerId: 'Account Manager',
  cityId: 'City',
  countryId: 'Country',
};

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

  protected readonly activeChips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const textFilters = this.store.textFilters();
    for (const [key, value] of Object.entries(textFilters) as [
      CustomerTextFilterKey,
      string | undefined,
    ][]) {
      if (value?.trim()) {
        chips.push({ key, label: TEXT_FILTER_LABELS[key], value: value.trim() });
      }
    }
    const filters = this.store.filters();
    if (filters.clientTypeId !== null) {
      chips.push({
        key: 'clientTypeId',
        label: CATEGORICAL_FILTER_LABELS.clientTypeId,
        value: this.filterLabel('clientTypeId'),
      });
    }
    if (filters.accountManagerId !== null) {
      chips.push({
        key: 'accountManagerId',
        label: CATEGORICAL_FILTER_LABELS.accountManagerId,
        value: this.filterLabel('accountManagerId'),
      });
    }
    if (filters.cityId !== null) {
      chips.push({
        key: 'cityId',
        label: CATEGORICAL_FILTER_LABELS.cityId,
        value: this.filterLabel('cityId'),
      });
    }
    if (filters.countryId !== null) {
      chips.push({
        key: 'countryId',
        label: CATEGORICAL_FILTER_LABELS.countryId,
        value: this.filterLabel('countryId'),
      });
    }
    return chips;
  });

  protected onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  protected clearSearch(): void {
    this.searchCleared.emit();
  }

  protected removeChip(key: CustomerTextFilterKey | CustomerFilterKey): void {
    if (isTextFilterKey(key)) {
      this.store.setTextFilter(key, '');
    } else {
      this.store.setCategoricalFilter(key, null);
    }
  }

  private filterLabel(key: CustomerFilterKey): string {
    const filters = this.store.filters();
    const value = filters[key];
    const options = {
      clientTypeId: this.store.clientTypeOptions(),
      accountManagerId: this.store.accountManagerOptions(),
      cityId: this.store.cityOptions(),
      countryId: this.store.countryOptions(),
    }[key];
    return options.find((option) => option.value === value)?.label ?? String(value);
  }
}

const TEXT_FILTER_KEYS: ReadonlySet<CustomerTextFilterKey> = new Set([
  'id',
  'code',
  'name',
  'email',
  'mobile',
]);

function isTextFilterKey(
  key: CustomerTextFilterKey | CustomerFilterKey,
): key is CustomerTextFilterKey {
  return TEXT_FILTER_KEYS.has(key as CustomerTextFilterKey);
}
