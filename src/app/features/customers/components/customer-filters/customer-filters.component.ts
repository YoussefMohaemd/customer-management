import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { SelectModule } from 'primeng/select';
import { PrimeTemplate } from 'primeng/api';

import {
  CATEGORICAL_OPERATORS,
  CustomerFilterKey,
  CustomerFilterOperator,
  CustomerTextFilterKey,
  DEFAULT_NUMERIC_OPERATOR,
  DEFAULT_TEXT_OPERATOR,
  NUMERIC_OPERATORS,
  TEXT_OPERATORS,
  customerOperatorLabel,
} from '@features/customers/models/customer-query.model';
import { CustomerStore } from '@features/customers/state/customer.store';

interface FilterFieldOption {
  key: string;
  label: string;
}

interface FilterOperatorOption {
  value: CustomerFilterOperator;
  label: string;
}

interface CategoricalValueOption {
  value: number | null;
  label: string;
}

/**
 * Filter button + panel (self-contained).
 *
 * The panel is driven by the currently selected table columns: only fields
 * that are both visible in the table and filterable are offered. The user
 * explicitly picks the field, the operator and the value, then presses
 * Apply. Table headers never trigger filtering.
 *
 * Free-text filters are composed into the server-side `Text` parameter of
 * the Read API and refined client-side by the chosen operator (the staging
 * API exposes no operator parameter). Categorical filters apply over the
 * loaded result set — see README.
 */
@Component({
  selector: 'app-customer-filters',
  imports: [FormsModule, ButtonModule, InputTextModule, PopoverModule, SelectModule, PrimeTemplate],
  templateUrl: './customer-filters.component.html',
  styleUrl: './customer-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFiltersComponent {
  protected readonly store = inject(CustomerStore);

  protected popoverOpen = false;

  /** Fields = currently visible table columns that support filtering. */
  protected readonly filterOptions = computed<FilterFieldOption[]>(() =>
    this.store
      .filterableColumnDefs()
      .map((column) => ({ key: column.filter!.key, label: column.label })),
  );

  protected readonly selectedFieldDef = computed<{
    key: string;
    kind: 'text' | 'numeric' | 'categorical';
  } | null>(() => {
    const options = this.filterOptions();
    const selected = options.find((option) => option.key === this.selectedField);
    if (!selected) {
      return null;
    }
    const def = this.store
      .filterableColumnDefs()
      .find((column) => column.filter!.key === selected.key);
    return def ? { key: selected.key, kind: def.filter!.kind } : null;
  });

  protected readonly operatorOptions = computed<FilterOperatorOption[]>(() => {
    const kind = this.selectedFieldDef()?.kind;
    const operators =
      kind === 'numeric'
        ? NUMERIC_OPERATORS
        : kind === 'categorical'
          ? CATEGORICAL_OPERATORS
          : TEXT_OPERATORS;
    return operators.map((operator) => ({
      value: operator,
      label: customerOperatorLabel(operator),
    }));
  });

  protected readonly categoricalValueOptions = computed<CategoricalValueOption[]>(() => {
    switch (this.selectedField) {
      case 'clientTypeId':
        return this.store.clientTypeOptions();
      case 'accountManagerId':
        return this.store.accountManagerOptions();
      case 'cityId':
        return this.store.cityOptions();
      case 'countryId':
        return this.store.countryOptions();
      default:
        return [];
    }
  });

  protected readonly canApply = computed(() => {
    const def = this.selectedFieldDef();
    if (!def || !this.selectedOperator) {
      return false;
    }
    if (def.kind === 'categorical') {
      return this.selectedCategoricalValue !== null && this.selectedCategoricalValue !== undefined;
    }
    return this.selectedTextValue.trim().length > 0;
  });

  protected selectedField: string | null = null;
  protected selectedOperator: CustomerFilterOperator | null = null;
  protected selectedTextValue = '';
  protected selectedCategoricalValue: number | null = null;

  /** Local editable copies bound to the panel inputs. */
  protected readonly values: Partial<Record<CustomerTextFilterKey, string>> &
    Partial<Record<CustomerFilterKey, number>> = {};

  protected onPanelOpen(): void {
    this.popoverOpen = true;
    this.syncValuesFromStore();
    this.syncSelectionFromStore();
  }

  protected onPanelClose(): void {
    this.popoverOpen = false;
  }

  protected onFieldChange(field: string | null | undefined): void {
    this.selectedField = field ?? null;
    const def = this.selectedFieldDef();
    this.selectedOperator = def
      ? def.kind === 'numeric'
        ? DEFAULT_NUMERIC_OPERATOR
        : DEFAULT_TEXT_OPERATOR
      : null;
    this.selectedTextValue = '';
    this.selectedCategoricalValue = null;
    if (field && this.store.textFilters()[field as CustomerTextFilterKey] !== undefined) {
      this.selectedTextValue = this.store.textFilters()[field as CustomerTextFilterKey] ?? '';
      this.selectedOperator =
        this.store.textFilterOperators()[field as CustomerTextFilterKey] ?? this.selectedOperator;
    }
  }

  protected onOperatorChange(operator: CustomerFilterOperator | null | undefined): void {
    this.selectedOperator = operator ?? null;
  }

  /** Sends the selected field/operator/value row to the store. */
  protected apply(): void {
    if (!this.canApply()) {
      return;
    }
    const def = this.selectedFieldDef();
    if (!def) {
      return;
    }
    if (def.kind === 'categorical') {
      this.onCategoricalFilterChange(def.key as CustomerFilterKey, this.selectedCategoricalValue);
      return;
    }
    if (!this.selectedOperator) {
      return;
    }
    this.store.applyTextFilter(
      def.key as CustomerTextFilterKey,
      this.selectedOperator,
      this.selectedTextValue.trim(),
    );
  }

  /** Clears the currently selected field's filter only. */
  protected clearCurrent(): void {
    const def = this.selectedFieldDef();
    if (!def) {
      return;
    }
    if (def.kind === 'categorical') {
      this.onCategoricalFilterChange(def.key as CustomerFilterKey, null);
      this.selectedCategoricalValue = null;
    } else {
      this.store.setTextFilter(def.key as CustomerTextFilterKey, '');
      this.selectedTextValue = '';
    }
  }

  protected clearAll(): void {
    this.store.clearAllFilters();
    this.syncValuesFromStore();
    this.selectedTextValue = '';
    this.selectedCategoricalValue = null;
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

  /** Reflects the store state into the local input copies on every open. */
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

  /**
   * Restores the field/operator/value row from the store when the panel
   * re-opens, dropping selections that no longer match the visible columns.
   */
  private syncSelectionFromStore(): void {
    if (this.selectedField && !this.filterOptions().some((o) => o.key === this.selectedField)) {
      this.selectedField = null;
    }
    if (!this.selectedField) {
      const active = TEXT_FILTER_KEYS.find((key) => (this.store.textFilters()[key] ?? '').trim());
      const categorical = CATEGORICAL_KEYS.find((key) => this.store.filters()[key] !== null);
      this.selectedField = active ?? categorical ?? null;
      this.selectedTextValue = active ? (this.store.textFilters()[active] ?? '') : '';
      this.selectedCategoricalValue = categorical ? this.store.filters()[categorical] : null;
      const kind = this.selectedFieldDef()?.kind;
      this.selectedOperator = active
        ? (this.store.textFilterOperators()[active] ??
          (kind === 'numeric' ? DEFAULT_NUMERIC_OPERATOR : DEFAULT_TEXT_OPERATOR))
        : kind
          ? kind === 'numeric'
            ? DEFAULT_NUMERIC_OPERATOR
            : DEFAULT_TEXT_OPERATOR
          : null;
    }
  }
}

const TEXT_FILTER_KEYS: readonly CustomerTextFilterKey[] = [
  'id',
  'code',
  'name',
  'email',
  'mobile',
];
const CATEGORICAL_KEYS: readonly CustomerFilterKey[] = [
  'clientTypeId',
  'accountManagerId',
  'cityId',
  'countryId',
];
