import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

interface ReportCard {
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
}

const REPORT_CARDS: readonly ReportCard[] = [
  { icon: 'pi-list', title: 'Customer List', subtitle: 'Full customer register with filters', accent: 'from-blue-500 to-indigo-600' },
  { icon: 'pi-globe', title: 'Customers by Country', subtitle: 'Geographic distribution analysis', accent: 'from-emerald-500 to-teal-600' },
  { icon: 'pi-calendar-plus', title: 'New Customers / Month', subtitle: 'Acquisition trend over time', accent: 'from-amber-500 to-orange-600' },
  { icon: 'pi-star', title: 'Top Account Managers', subtitle: 'Performance ranking by activity', accent: 'from-violet-500 to-purple-600' }
];

/** Presentational "Reports" section matching the assessment reference. */
@Component({
  selector: 'app-reports-section',
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      @for (report of cards; track report.title) {
        <button
          type="button"
          (click)="onOpen(report.title)"
          class="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <div class="h-1.5 w-full bg-gradient-to-r" [class]="report.accent" aria-hidden="true"></div>
          <div class="p-4">
            <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-600" aria-hidden="true">
              <i [class]="report.icon" class="pi text-base"></i>
            </div>
            <div class="text-sm font-semibold text-slate-800">{{ report.title }}</div>
            <p class="mt-0.5 text-xs leading-5 text-slate-400">{{ report.subtitle }}</p>
          </div>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsSectionComponent {
  protected readonly cards = REPORT_CARDS;
  private readonly messageService = inject(MessageService);

  protected onOpen(title: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Reports',
      detail: `${title} is not part of the provided API assessment.`,
      life: 2500
    });
  }
}