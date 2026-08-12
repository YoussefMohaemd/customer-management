import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerFiltersComponent } from '@features/customers/components/customer-filters/customer-filters.component';
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
 * are emitted through `searchChange` and the RxJS debounce/cancel pipeline
 * lives in the page component. The filters panel is self-contained.
 */
@Component({
  selector: 'app-customer-toolbar',
  imports: [FormsModule, ButtonModule, InputTextModule, TooltipModule, CustomerFiltersComponent],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Server-side search -->
        <div class="relative min-w-[220px] flex-1">
          <i
            class="pi pi-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400"
            aria-hidden="true"
          ></i>
          <input
            type="search"
            [ngModel]="searchValue()"
            (ngModelChange)="onSearchInput($event)"
            placeholder="Search by name, code, mobile or email…"
            aria-label="Search customers"
            class="h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-16 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
          @if (searchValue()) {
            <button
              type="button"
              (click)="clearSearch()"
              class="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              aria-label="Clear search"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          }
        </div>

        <app-customer-filters />

        @if (store.hasFilters()) {
          <p-button
            label="Clear filters"
            icon="pi pi-filter-slash"
            [text]="true"
            size="small"
            (onClick)="store.clearAllFilters()"
            [pTooltip]="'Remove all filters'"
            tooltipPosition="bottom"
          />
        }
      </div>

      <!-- Selected filter chips -->
      @if (store.totalFilterCount() > 0) {
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-slate-400">Active filters:</span>
          @for (chip of activeChips(); track chip.key) {
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-blue-700"
            >
              {{ chip.label }}: {{ chip.value }}
              <button
                type="button"
                (click)="removeChip(chip.key)"
                class="flex h-4 w-4 items-center justify-center rounded-full text-blue-400 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                [attr.aria-label]="'Remove ' + chip.label + ' filter'"
              >
                <i class="pi pi-times text-[9px]"></i>
              </button>
            </span>
          }
          <button
            type="button"
            (click)="store.clearAllFilters()"
            class="rounded text-xs font-medium text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            Clear all
          </button>
        </div>
      }
    </div>
  `,
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
