import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { PrimeTemplate } from 'primeng/api';

import { CustomerTextFilterKey, CustomerFilterKey } from '@features/customers/models/customer-query.model';
import { CustomerStore } from '@features/customers/state/customer.store';

/**
 * Filter button + popover panel (self-contained).
 *
 * Free-text filters (ID, Code, Name, Email, Mobile) are composed into the
 * server-side `Text` parameter of the Read API. Categorical filters
 * (Client Type, Account Manager, City, Country) are applied over the loaded
 * result set because the staging API exposes no categorical parameters —
 * see README → Known API Limitations.
 */
@Component({
  selector: 'app-customer-filters',
  imports: [FormsModule, ButtonModule, InputTextModule, PopoverModule, SelectModule, BadgeModule, PrimeTemplate],
  template: `
    <button
      #filterButton
      type="button"
      (click)="popover.toggle($event)"
      class="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      [attr.aria-haspopup]="'dialog'"
      [attr.aria-expanded]="popoverOpen"
      aria-label="Toggle filters"
    >
      <i class="pi pi-filter text-sm" aria-hidden="true"></i>
      <span class="hidden sm:inline">Filter</span>
      @if (store.totalFilterCount() > 0) {
        <span
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white"
          aria-label="{{ store.totalFilterCount() }} active filters"
        >
          {{ store.totalFilterCount() }}
        </span>
      }
    </button>

    <p-popover #popover [dismissable]="true" appendTo="body" (onShow)="onPanelOpen()" (onHide)="onPanelClose()">
      <ng-template pTemplate="content">
        <div class="w-[320px] sm:w-[380px]">
          <div class="border-b border-slate-200 px-4 py-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-800">Filters</h3>
              <button
                type="button"
                (click)="clearAll()"
                class="rounded text-xs font-medium text-blue-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-not-allowed disabled:text-slate-300"
                [disabled]="store.totalFilterCount() === 0"
              >
                Clear all
              </button>
            </div>
            <p class="mt-0.5 text-[11px] leading-4 text-slate-400">
              Text filters are sent to the server. Categorical filters apply to the loaded result set.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3 px-4 py-4">
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              ID
              <input pInputText type="number" inputmode="numeric" [(ngModel)]="values.id" (ngModelChange)="onTextFilterChange('id', $event)" placeholder="e.g. 1024" class="w-full" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Code
              <input pInputText type="text" [(ngModel)]="values.code" (ngModelChange)="onTextFilterChange('code', $event)" placeholder="CUST-001" class="w-full" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Name
              <input pInputText type="text" [(ngModel)]="values.name" (ngModelChange)="onTextFilterChange('name', $event)" placeholder="Customer name" class="w-full" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Email
              <input pInputText type="email" [(ngModel)]="values.email" (ngModelChange)="onTextFilterChange('email', $event)" placeholder="name@company.com" class="w-full" />
            </label>
            <label class="col-span-2 flex flex-col gap-1 text-xs font-medium text-slate-600">
              Mobile
              <input pInputText type="tel" [(ngModel)]="values.mobile" (ngModelChange)="onTextFilterChange('mobile', $event)" placeholder="+20 1xx xxx xxxx" class="w-full" />
            </label>

            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Client Type
              <p-select
                [options]="store.clientTypeOptions()"
                [(ngModel)]="values.clientTypeId"
                optionLabel="label"
                optionValue="value"
                placeholder="All types"
                [showClear]="true"
                class="w-full"
                (ngModelChange)="onCategoricalFilterChange('clientTypeId', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Account Manager
              <p-select
                [options]="store.accountManagerOptions()"
                [(ngModel)]="values.accountManagerId"
                optionLabel="label"
                optionValue="value"
                placeholder="All managers"
                [showClear]="true"
                class="w-full"
                (ngModelChange)="onCategoricalFilterChange('accountManagerId', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              City
              <p-select
                [options]="store.cityOptions()"
                [(ngModel)]="values.cityId"
                optionLabel="label"
                optionValue="value"
                placeholder="All cities"
                [showClear]="true"
                class="w-full"
                (ngModelChange)="onCategoricalFilterChange('cityId', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Country
              <p-select
                [options]="store.countryOptions()"
                [(ngModel)]="values.countryId"
                optionLabel="label"
                optionValue="value"
                placeholder="All countries"
                [showClear]="true"
                class="w-full"
                (ngModelChange)="onCategoricalFilterChange('countryId', $event)"
              />
            </label>
          </div>
        </div>
      </ng-template>
    </p-popover>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerFiltersComponent {
  protected readonly store = inject(CustomerStore);

  protected popoverOpen = false;

  protected readonly values: Partial<Record<CustomerTextFilterKey, string>> & Partial<Record<CustomerFilterKey, number>> = {};

  protected onPanelOpen(): void {
    this.popoverOpen = true;
    this.syncValuesFromStore();
  }

  protected onPanelClose(): void {
    this.popoverOpen = false;
  }

  protected onTextFilterChange(key: CustomerTextFilterKey, value: string | number | null | undefined): void {
    this.store.setTextFilter(key, value === null || value === undefined ? '' : String(value));
  }

  protected onCategoricalFilterChange(key: CustomerFilterKey, value: number | null | undefined): void {
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