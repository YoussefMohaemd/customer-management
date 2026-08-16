import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { environment } from '@environments/environment';
import { CustomerRecord } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';
import { CustomerToolbarComponent } from '@features/customers/components/customer-toolbar/customer-toolbar.component';
import { CustomerTableComponent } from '@features/customers/components/customer-table/customer-table.component';
import { CustomerFormDialogComponent } from '@features/customers/components/customer-form-dialog/customer-form-dialog.component';
import { CustomerActionsComponent } from '@features/customers/components/customer-actions/customer-actions.component';
import { CustomerReportsComponent } from '@features/customers/components/customer-reports/customer-reports.component';
import { CustomerExcelService } from '@features/customers/services/customer-excel.service';

/**
 * Customer page — orchestrator of the feature.
 *
 * All async orchestration (debounced search, filter reloads, retry) is owned
 * by the store's RxJS pipeline; this component only fires trigger methods and
 * composes the presentational sections (toolbar, table, paginator, dialog).
 *
 * The feature route is lazy-loaded; the component uses OnPush so only
 * signal-driven changes trigger re-renders.
 */
@Component({
  selector: 'app-customer-page',
  imports: [
    FormsModule,
    ButtonModule,
    TooltipModule,
    ConfirmDialogModule,
    CustomerToolbarComponent,
    CustomerTableComponent,
    CustomerFormDialogComponent,
    CustomerActionsComponent,
    CustomerReportsComponent,
  ],
  templateUrl: './customer-page.component.html',
  styleUrl: './customer-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPageComponent implements OnInit {
  protected readonly store = inject(CustomerStore);
  private readonly excelService = inject(CustomerExcelService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizeOptions = environment.customers.pageSizeOptions;

  /** True while the Excel export downloads the full matching set from the BFF. */
  protected readonly exporting = signal(false);

  protected readonly totalLabel = computed(() => this.store.totalRecords().toLocaleString());

  /** Up to 5 page links, sliding around the current page. */
  protected readonly pageLinks = computed<number[]>(() => {
    const page = this.store.page();
    const total = this.store.totalPages();
    if (total <= 1) {
      return [1];
    }
    const start = Math.max(1, Math.min(page - 2, total - 4));
    const count = Math.min(5, total - start + 1);
    return Array.from({ length: count }, (_, index) => start + index);
  });

  ngOnInit(): void {
    this.store.reload();
  }

  protected onSearchInput(value: string): void {
    this.store.search(value);
  }

  protected onSearchCleared(): void {
    this.store.clearSearch();
  }

  /** Retry the current query (used by the error state). */
  protected reload(): void {
    this.store.reload();
  }

  /** Refresh button: always resets pagination to page 1 before reloading. */
  protected refreshTable(): void {
    this.store.refresh();
  }

  protected resetAndReload(): void {
    this.store.clearAllFilters();
    this.store.clearSearch();
  }

  protected goToPage(page: number): void {
    this.store.setPage(page);
  }

  protected changePageSize(size: string | number): void {
    this.store.setPageSize(Number(size));
  }

  protected async exportExcel(): Promise<void> {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    try {
      // The BFF applies the current search + filters + sort and returns the
      // full matching set (no pagination) so the export covers the entire
      // result, never just the visible page.
      const records = await firstValueFrom(this.store.exportAll());
      if (records.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Nothing to export',
          detail: 'There are no matching customers to export.',
          life: 3000,
        });
        return;
      }
      this.excelService.exportCustomers(records);
      this.messageService.add({
        severity: 'success',
        summary: 'Export started',
        detail: `${records.length.toLocaleString()} customers exported to Excel (current result set).`,
        life: 4000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Export failed',
        detail: 'The matching customers could not be fetched for export.',
        life: 4000,
      });
    } finally {
      this.exporting.set(false);
    }
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
          detail:
            'The staging API does not expose a remove-customer endpoint. Deleting is not simulated.',
          life: 4000,
        });
      },
    });
  }
}
