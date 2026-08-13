import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { CustomerReportDef } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';

const REPORT_CARDS: readonly CustomerReportDef[] = [
  {
    id: 'customer-list',
    icon: 'pi-list',
    title: 'Customer List',
    subtitle: 'Full customer register with filters',
    accent: 'from-blue-500 to-indigo-600',
    requiredColumns: [
      'id',
      'code',
      'commercialName',
      'email',
      'mobile',
      'accountTypeName',
      'accountManagerName',
      'city',
      'country',
    ],
    defaultSortField: 'id',
    defaultSortDirection: 'asc',
  },
  {
    id: 'by-country',
    icon: 'pi-globe',
    title: 'Customers by Country',
    subtitle: 'Geographic distribution analysis',
    accent: 'from-emerald-500 to-teal-600',
    requiredColumns: ['country', 'city', 'commercialName', 'accountTypeName'],
    defaultSortField: 'country',
    defaultSortDirection: 'asc',
  },
  {
    id: 'new-customers',
    icon: 'pi-calendar-plus',
    title: 'New Customers / Month',
    subtitle: 'Acquisition trend over time',
    accent: 'from-amber-500 to-orange-600',
    requiredColumns: ['id', 'code', 'commercialName', 'accountTypeName', 'accountManagerName'],
    defaultSortField: 'id',
    defaultSortDirection: 'desc',
  },
  {
    id: 'top-managers',
    icon: 'pi-star',
    title: 'Top Account Managers',
    subtitle: 'Performance ranking by activity',
    accent: 'from-violet-500 to-purple-600',
    requiredColumns: ['accountManagerName', 'commercialName', 'accountTypeName', 'city'],
    defaultSortField: 'accountManagerName',
    defaultSortDirection: 'asc',
  },
];

/** Reports section synchronized with CustomerStore query and dynamic column selection. */
@Component({
  selector: 'app-customer-reports',
  templateUrl: './customer-reports.component.html',
  styleUrl: './customer-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReportsComponent {
  protected readonly cards = REPORT_CARDS;
  protected readonly store = inject(CustomerStore);
  private readonly messageService = inject(MessageService);

  protected onOpen(report: CustomerReportDef): void {
    const isCurrentlyActive = this.store.activeReport()?.id === report.id;
    this.store.selectReport(report);
    if (isCurrentlyActive) {
      this.messageService.add({
        severity: 'info',
        summary: report.title,
        detail: `Deactivated ${report.title} mode — table layout restored.`,
        life: 2500,
      });
    } else {
      this.messageService.add({
        severity: 'info',
        summary: report.title,
        detail: `Configured table for ${report.title}.`,
        life: 2500,
      });
    }
  }
}