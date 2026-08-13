import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

import { environment } from '@environments/environment';
import {
  CustomerFilterKey,
  CustomerTextFilterKey,
  TEXT_FILTER_KEYS,
  isTextFilterKey,
} from '@features/customers/models/customer-query.model';
import { CustomerStore } from '@features/customers/state/customer.store';

type TextFilterField = { key: CustomerTextFilterKey; label: string; kind: 'text' | 'numeric' };
type CategoricalFilterField = { key: CustomerFilterKey; label: string; kind: 'categorical' };
type FilterField = TextFilterField | CategoricalFilterField;

interface CategoricalValueOption {
  value: number | null;
  label: string;
}

/**
 * Filter panel (rendered by the toolbar as a block directly underneath the
 * toolbar row — never inside it).
 *
 * The panel is fully derived from the existing Columns dropdown: one filter
 * input is generated for every column currently selected there, so the user
 * never picks the fields again. Changing the column selection immediately
 * re-renders the panel (adds/removes inputs) and any filter value that loses
 * its column is pruned.
 *
 * The toolbar creates/destroys this component to open/close the panel, so the
 * open/close bookkeeping is lifecycle-based: drafts are restored from the
 * store on creation and flushed back on destruction.
 *
 * Free-text filters are drafted locally and flushed to the store debounced
 * while typing; both free-text and categorical filters are applied over the
 * loaded result set (the staging API exposes no per-field filter parameters)
 * — see README.
 */
@Component({
  selector: 'app-customer-filters',
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './customer-filters.component.html',
  styleUrl: './customer-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFiltersComponent implements OnInit, OnDestroy {
  protected readonly store = inject(CustomerStore);
  private readonly destroyRef = inject(DestroyRef);

  /** One filter field per column currently selected in the Columns dropdown. */
  protected readonly filterFields = computed<FilterField[]>(() =>
    this.store.filterableColumnDefs().map((column) => {
      const filter = column.filter!;
      if (filter.kind === 'categorical') {
        return {
          key: filter.key as CustomerFilterKey,
          label: column.label,
          kind: 'categorical' as const,
        };
      }
      return {
        key: filter.key as CustomerTextFilterKey,
        label: column.label,
        kind: filter.kind,
      };
    }),
  );

  /** Local free-text drafts; flushed to the store debounced while typing. */
  protected readonly textDrafts = signal<Partial<Record<CustomerTextFilterKey, string>>>({});

  /** True while the store or the pending drafts hold any filter value. */
  protected readonly hasFilterValues = computed(
    () =>
      this.store.totalFilterCount() > 0 ||
      Object.values(this.textDrafts()).some((value) => (value ?? '').trim().length > 0),
  );

  private readonly flush$ = new Subject<void>();

  constructor() {
    this.flush$
      .pipe(
        debounceTime(environment.customers.searchDebounceMs),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.flushTextDrafts());

    // Drop drafts for columns deselected in the Columns dropdown so no ghost
    // value is flushed back when the panel closes.
    effect(() => {
      const visibleKeys = new Set(this.filterFields().map((field) => field.key));
      this.textDrafts.update((drafts) => {
        if (Object.keys(drafts).every((key) => visibleKeys.has(key as CustomerTextFilterKey))) {
          return drafts;
        }
        const next: Partial<Record<CustomerTextFilterKey, string>> = {};
        for (const key of TEXT_FILTER_KEYS) {
          if (visibleKeys.has(key)) {
            next[key] = drafts[key];
          }
        }
        return next;
      });
    });
  }

  /** Opening the panel: restore the committed store values as local drafts. */
  ngOnInit(): void {
    this.syncDraftsFromStore();
  }

  /** Closing the panel: push the pending drafts into the store. */
  ngOnDestroy(): void {
    this.flushTextDrafts();
  }

  protected textValueFor(key: CustomerTextFilterKey): string {
    return this.textDrafts()[key] ?? '';
  }

  protected categoricalValueFor(key: CustomerFilterKey): number | null {
    return this.store.filters()[key] ?? null;
  }

  protected categoricalOptionsFor(key: CustomerFilterKey): CategoricalValueOption[] {
    switch (key) {
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
  }

  protected onTextInput(key: CustomerTextFilterKey, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.textDrafts.update((drafts) => ({
      ...drafts,
      [key]: value,
    }));
  }

  protected onCategoricalChange(key: CustomerFilterKey, value: number | null | undefined): void {
    this.store.setCategoricalFilter(key, value ?? null);
  }

  protected clearAll(): void {
    this.store.clearAllFilters();
    this.textDrafts.set({});
  }

  /** Pushes only the drafts that differ from the committed store values. */
  protected flushTextDrafts(): void {
    const drafts = this.textDrafts();
    const committed = this.store.textFilters();
    for (const key of TEXT_FILTER_KEYS) {
      const draft = (drafts[key] ?? '').trim();
      if (draft !== (committed[key] ?? '').trim()) {
        this.store.setTextFilter(key, draft);
      }
    }
  }

  /** Restores the committed store values into the local drafts on open. */
  private syncDraftsFromStore(): void {
    const drafts: Partial<Record<CustomerTextFilterKey, string>> = {};
    for (const key of TEXT_FILTER_KEYS) {
      drafts[key] = this.store.textFilters()[key] ?? '';
    }
    this.textDrafts.set(drafts);
  }
}
