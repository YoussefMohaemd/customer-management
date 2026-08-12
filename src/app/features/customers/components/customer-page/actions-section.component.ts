import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

interface ActionCard {
  icon: string;
  title: string;
  description: string;
  accent: 'blue' | 'amber' | 'emerald';
}

const ACTION_CARDS: readonly ActionCard[] = [
  {
    icon: 'pi-share-alt',
    title: 'Collective Reassign',
    description: 'Reassign selected customers to another account manager in one operation.',
    accent: 'blue',
  },
  {
    icon: 'pi-phone',
    title: 'Customer Follow Up',
    description: 'Schedule and manage follow-up calls and meeting reminders for your accounts.',
    accent: 'amber',
  },
  {
    icon: 'pi-cloud-upload',
    title: 'Upload Bulk',
    description: 'Import multiple customers at once from an Excel or CSV spreadsheet file.',
    accent: 'emerald',
  },
];

const ACCENT_STYLES: Record<ActionCard['accent'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

/** Presentational "Actions" strip matching the assessment reference. */
@Component({
  selector: 'app-actions-section',
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      @for (card of cards; track card.title) {
        <button
          type="button"
          (click)="onOpen(card.title)"
          class="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            [class]="accentStyle(card.accent)"
            aria-hidden="true"
          >
            <i [class]="card.icon" class="pi text-lg"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
              {{ card.title }}
              <i
                class="pi pi-arrow-up-right text-xs text-slate-300 transition group-hover:text-blue-500"
                aria-hidden="true"
              ></i>
            </div>
            <p class="mt-1 text-xs leading-5 text-slate-400">{{ card.description }}</p>
          </div>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsSectionComponent {
  protected readonly cards = ACTION_CARDS;
  private readonly messageService = inject(MessageService);

  protected accentStyle(accent: ActionCard['accent']): string {
    return ACCENT_STYLES[accent];
  }

  protected onOpen(title: string): void {
    this.messageService.add({
      severity: 'info',
      summary: title,
      detail: 'This module is not part of the provided API assessment.',
      life: 2500,
    });
  }
}
