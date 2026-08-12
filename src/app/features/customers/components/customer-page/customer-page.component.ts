import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
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
    ButtonModule,
    PaginatorModule,
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

  ngOnInit(): void {
    this.store.reload();
  }

  protected onSearchInput(value: string): void {
    this.store.search(value);
  }

  protected onSearchCleared(): void {
    this.store.clearSearch();
  }

  protected reload(): void {
    this.store.reload();
  }

  protected resetAndReload(): void {
    this.store.clearAllFilters();
    this.store.clearSearch();
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