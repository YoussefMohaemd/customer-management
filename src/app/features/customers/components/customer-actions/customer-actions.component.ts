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
  selector: 'app-customer-actions',
  templateUrl: './customer-actions.component.html',
  styleUrl: './customer-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActionsComponent {
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