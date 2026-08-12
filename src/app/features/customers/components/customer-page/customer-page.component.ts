import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, EMPTY } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PaginatorState } from 'primeng/paginator';

import { environment } from '@environments/environment';
import { CustomerRecord } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerToolbarComponent } from '@features/customers/components/customer-toolbar/customer-toolbar.component';
import { CustomerTableComponent } from '@features/customers/components/customer-table/customer-table.component';
import { CustomerFormDialogComponent } from '@features/customers/components/customer-form-dialog/customer-form-dialog.component';
import { CustomerExcelService } from '@features/customers/services/customer-excel.service';
import { ActionsSectionComponent } from '@features/customers/components/customer-page/actions-section.component';
import { ReportsSectionComponent } from '@features/customers/components/customer-page/reports-section.component';

/**
 * Customer page — the orchestrator of the feature.
 *
 * Responsibilities:
 *  - owns the RxJS search pipeline (debounce → distinct → switchMap → store)
 *  - owns the reload pipeline and the initial load
 *  - orchestrates delete confirmation and Excel export
 *  - composes presentational sections (toolbar, table, paginator, dialog)
 *
 * The feature route is lazy-loaded; the component uses OnPush so only
 * signal-driven changes trigger re-renders.
 */
@Component({
  selector: 'app-customer-page',
  imports: [
    ButtonModule,
    PaginatorModule,
    TooltipModule,
    ConfirmDialogModule,
    CustomerToolbarComponent,
    CustomerTableComponent,
    CustomerFormDialogComponent,
    ActionsSectionComponent,
    ReportsSectionComponent
  ],
  template: `
    <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <!-- Page heading -->
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p class="mt-1 text-sm text-slate-500">
            Manage your customer base
            @if (store.hasRecords()) {
              · {{ store.totalRecords().toLocaleString() }} matching records
            }
            @if (store.hasServerSearch() || store.hasFilters()) {
              · {{ store.sortedRecords().length.toLocaleString() }} after {{ store.hasServerSearch() ? 'search' : '' }}
              {{ store.hasServerSearch() && store.hasFilters() ? 'and' : '' }} {{ store.hasFilters() ? 'filters' : '' }}
            }
          </p>
        </div>
        <div class="flex items-center gap-2.5">
          <p-button
            label="Export Excel"
            icon="pi pi-file-excel"
            [outlined]="true"
            severity="contrast"
            (onClick)="exportExcel()"
            [disabled]="store.sortedRecords().length === 0"
            [pTooltip]="store.sortedRecords().length === 0 ? 'Nothing to export yet' : 'Export the current result set'"
            tooltipPosition="top"
          />
          <p-button label="Add Customer" icon="pi pi-plus" (onClick)="store.openCreateForm()" />
        </div>
      </div>

      <!-- Main card -->
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-4 py-4 sm:px-5">
          <app-customer-toolbar
            [searchValue]="store.searchTerm()"
            (searchChange)="onSearchInput($event)"
            (searchCleared)="onSearchCleared()"
          />
        </div>

        <!-- Load warning -->
        @if (store.loadWarning()) {
          <div
            class="flex items-start gap-2.5 border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800"
            role="status"
          >
            <i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i>
            <div>{{ store.loadWarning() }}</div>
          </div>
        }

        <!-- Error state -->
        @if (store.error() && !store.loading()) {
          <div class="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center" role="alert">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden="true">
              <i class="pi pi-exclamation-circle text-2xl"></i>
            </div>
            <div>
              <div class="text-base font-semibold text-slate-800">We couldn't load your customers</div>
              <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">{{ store.error() }}</p>
            </div>
            <div class="flex items-center gap-2">
              <p-button label="Try again" icon="pi pi-refresh" size="small" (onClick)="reload()" />
              <p-button
                label="Clear search & filters"
                icon="pi pi-filter-slash"
                [text]="true"
                size="small"
                (onClick)="resetAndReload()"
                [disabled]="!store.hasServerSearch() && !store.hasFilters()"
              />
            </div>
          </div>
        }

        <!-- Table -->
        @if (!(store.error() && !store.loading())) {
          <app-customer-table (deleteRequested)="onDeleteRequested($event)" />
        }
      </div>

      <!-- Paginator -->
      @if (!store.error() && store.hasRecords()) {
        <p-paginator
          [first]="(store.page() - 1) * store.pageSize()"
          [rows]="store.pageSize()"
          [totalRecords]="store.sortedRecords().length"
          [rowsPerPageOptions]="pageSizeOptions"
          [pageLinkSize]="3"
          [showFirstLastIcon]="true"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} customers"
          styleClass="!rounded-xl !border !border-slate-200 !bg-white !shadow-sm"
          (onPageChange)="onPageChange($event)"
        />
      }

      <!-- Actions -->
      <section aria-label="Customer actions">
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Actions</h2>
        <app-actions-section />
      </section>

      <!-- Reports -->
      <section aria-label="Reports">
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Reports</h2>
        <app-reports-section />
      </section>
    </div>

    <app-customer-form-dialog />
    <p-confirmdialog [style]="{ width: 'min(92vw, 440px)' }" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerPageComponent implements OnInit {
  protected readonly store = inject(CustomerStore);
  private readonly excelService = inject(CustomerExcelService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizeOptions = environment.customers.pageSizeOptions;

  // Debounced server-side search pipeline.
  private readonly searchTerms$ = new Subject<string>();
  // Explicit reload trigger (filters, retry, refresh after save).
  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    this.searchTerms$
      .pipe(
        debounceTime(environment.customers.searchDebounceMs),
        distinctUntilChanged(),
        switchMap((term) => this.store.searchCustomers(term).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    this.reload$
      .pipe(
        switchMap(() => this.store.loadCustomers().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    this.reload();
  }

  protected onSearchInput(value: string): void {
    this.searchTerms$.next(value);
  }

  protected onSearchCleared(): void {
    this.searchTerms$.next('');
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected resetAndReload(): void {
    this.store.clearSearch();
    this.store.clearAllFilters();
    this.reload();
  }

  protected onPageChange(event: PaginatorState): void {
    if (event.rows !== this.store.pageSize()) {
      this.store.setPageSize(event.rows ?? 1);
      return;
    }
    this.store.setPage((event.first ?? 0) / (event.rows ?? 1) + 1);
  }

  protected exportExcel(): void {
    const records = this.store.sortedRecords();
    if (records.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Nothing to export', detail: 'There are no matching customers to export.', life: 3000 });
      return;
    }
    this.excelService.exportCustomers(records);
    this.messageService.add({
      severity: 'success',
      summary: 'Export started',
      detail: `${records.length.toLocaleString()} customers exported to Excel (current result set).`,
      life: 4000
    });
  }

  protected onDeleteRequested(customer: CustomerRecord): void {
    this.confirmationService.confirm({
      message: `Delete "${customer.commercialName}"? A delete endpoint is not part of the provided API in this assessment.`,
      header: 'Delete Customer',
      icon: 'pi pi-info-circle',
      acceptLabel: 'Not available',
      acceptIcon: 'pi pi-times',
      rejectLabel: 'Close',
      rejectIcon: 'pi pi-arrow-left',
      accept: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Delete unavailable',
          detail: 'The staging API does not expose a remove-customer endpoint. Deleting is not simulated.',
          life: 4000
        });
      }
    });
  }
}