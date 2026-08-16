import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { CustomerReportDef } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';

/**
 * Declarative Reports section configuration — the single source of truth for
 * every report card. Selecting a report routes its `id` through the shared
 * CustomerStore query state (`report` param), so the BFF applies the matching
 * server-side criteria (`CUSTOMER_REPORT_CRITERIA` in `server/src/query.js`)
 * and the Customer Table genuinely filters its data source. The criteria here
 * mirror the server definitions and stay composed with search, user filters,
 * sorting and pagination.
 */
const REPORT_CARDS: readonly CustomerReportDef[] = [
  {
    id: 'contacts',
    icon: 'pi-phone',
    title: 'Contacts Report',
    subtitle: 'Report For Contacts.',
    accent: 'blue',
    requiredColumns: ['id', 'code', 'commercialName', 'email', 'mobile', 'phone'],
    defaultSortField: 'commercialName',
    defaultSortDirection: 'asc',
    filterCriteria: { anyOf: ['email', 'mobile', 'phone'] },
  },
  {
    id: 'customers',
    icon: 'pi-user',
    title: 'Customer Report',
    subtitle: 'Report For Customers.',
    accent: 'indigo',
    requiredColumns: [
      'id',
      'code',
      'commercialName',
      'accountTypeName',
      'accountManagerName',
      'email',
      'mobile',
      'city',
      'country',
    ],
    defaultSortField: 'id',
    defaultSortDirection: 'asc',
    filterCriteria: { allOf: ['accountManagerId'] },
  },
  {
    id: 'account-follow-up',
    icon: 'pi-thumbs-up',
    title: 'Account Follow Up Report',
    subtitle: 'Report For Accounts Follow Up.',
    accent: 'amber',
    requiredColumns: [
      'id',
      'code',
      'commercialName',
      'mobile',
      'email',
      'accountManagerName',
      'status',
    ],
    defaultSortField: 'id',
    defaultSortDirection: 'asc',
    filterCriteria: { noneOf: ['accountManagerId'] },
  },
];

const ACCENT_STYLES: Record<CustomerReportDef['accent'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
};

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

  /** Only the currently selected report may render as active. */
  protected isActive(report: CustomerReportDef): boolean {
    return this.store.activeReport()?.id === report.id;
  }

  protected iconClass(report: CustomerReportDef): string {
    const classes = ACCENT_STYLES[report.accent];
    return this.isActive(report) ? `${classes} scale-110 shadow-sm` : classes;
  }

  /**
   * Clicking an inactive report activates it (criteria reach the table through
   * the store's existing request pipeline). Clicking the active report again
   * clears the selection and returns the table to its normal state — exactly
   * one store transition, one query, one table request either way.
   */
  protected onOpen(report: CustomerReportDef): void {
    const isCurrentlyActive = this.isActive(report);
    this.store.selectReport(report);
    this.messageService.add({
      severity: 'info',
      summary: report.title,
      detail: isCurrentlyActive
        ? `Deactivated ${report.title} — the table returned to the normal state.`
        : `Applied ${report.title} — only matching customers are shown.`,
      life: 2500,
    });
  }
}
