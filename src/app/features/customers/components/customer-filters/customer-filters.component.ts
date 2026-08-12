import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { PrimeTemplate } from 'primeng/api';

import {
  CustomerTextFilterKey,
  CustomerFilterKey,
} from '@features/customers/models/customer-query.model';
import { CustomerStore } from '@features/customers/state/customer.store';

/**
 * Filter button + popover panel (self-contained).
 *
 * Free-text filters (ID, Code, Name, Email, Mobile) are composed into the
 * server-side `Text` parameter of the Read API — changing one triggers a
 * debounced server reload through the store. Categorical filters (Client
 * Type, Account Manager, City, Country) apply over the loaded result set
 * because the staging API exposes no categorical parameters — see README.
 */
@Component({
  selector: 'app-customer-filters',
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    PopoverModule,
    SelectModule,
    BadgeModule,
    PrimeTemplate,
  ],
  templateUrl: './customer-filters.component.html',
  styleUrl: './customer-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFiltersComponent {
  protected readonly store = inject(CustomerStore);

  protected popoverOpen = false;

  protected readonly values: Partial<Record<CustomerTextFilterKey, string>> &
    Partial<Record<CustomerFilterKey, number>> = {};

  protected onPanelOpen(): void {
    this.popoverOpen = true;
    this.syncValuesFromStore();
  }

  protected onPanelClose(): void {
    this.popoverOpen = false;
  }

  protected onTextFilterChange(
    key: CustomerTextFilterKey,
    value: string | number | null | undefined,
  ): void {
    this.store.setTextFilter(key, value === null || value === undefined ? '' : String(value));
  }

  protected onCategoricalFilterChange(
    key: CustomerFilterKey,
    value: number | null | undefined,
  ): void {
    this.store.setCategoricalFilter(key, value ?? null);
  }

  protected clearAll(): void {
    this.store.clearAllFilters();
    this.syncValuesFromStore();
  }

  /** Reflects the store state into the local editable copies on every open. */
  private syncValuesFromStore(): void {
    const textFilters = this.store.textFilters();
    const filters = this.store.filters();
    this.values.id = textFilters.id ?? '';
    this.values.code = textFilters.code ?? '';
    this.values.name = textFilters.name ?? '';
    this.values.email = textFilters.email ?? '';
    this.values.mobile = textFilters.mobile ?? '';
    this.values.clientTypeId = filters.clientTypeId ?? undefined;
    this.values.accountManagerId = filters.accountManagerId ?? undefined;
    this.values.cityId = filters.cityId ?? undefined;
    this.values.countryId = filters.countryId ?? undefined;
  }
}