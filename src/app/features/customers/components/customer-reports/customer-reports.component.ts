import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

interface ReportCard {
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
}

const REPORT_CARDS: readonly ReportCard[] = [
  {
    icon: 'pi-list',
    title: 'Customer List',
    subtitle: 'Full customer register with filters',
    accent: 'from-blue-500 to-indigo-600',
  },
  {
    icon: 'pi-globe',
    title: 'Customers by Country',
    subtitle: 'Geographic distribution analysis',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    icon: 'pi-calendar-plus',
    title: 'New Customers / Month',
    subtitle: 'Acquisition trend over time',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    icon: 'pi-star',
    title: 'Top Account Managers',
    subtitle: 'Performance ranking by activity',
    accent: 'from-violet-500 to-purple-600',
  },
];

/** Presentational "Reports" section matching the assessment reference. */
@Component({
  selector: 'app-customer-reports',
  templateUrl: './customer-reports.component.html',
  styleUrl: './customer-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReportsComponent {
  protected readonly cards = REPORT_CARDS;
  private readonly messageService = inject(MessageService);

  protected onOpen(title: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Reports',
      detail: `${title} is not part of the provided API assessment.`,
      life: 2500,
    });
  }
}