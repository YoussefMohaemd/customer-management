import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { CustomerActionDef } from '@features/customers/models/customer.model';
import { CustomerStore } from '@features/customers/state/customer.store';

const ACTION_CARDS: readonly CustomerActionDef[] = [
  {
    id: 'reassign',
    icon: 'pi-share-alt',
    title: 'Collective Reassign',
    description: 'Reassign selected customers to another account manager in one operation.',
    accent: 'blue',
    requiredColumns: ['accountManagerName', 'code', 'commercialName'],
    requiresSelection: true,
  },
  {
    id: 'followup',
    icon: 'pi-phone',
    title: 'Customer Follow Up',
    description: 'Schedule and manage follow-up calls and meeting reminders for your accounts.',
    accent: 'amber',
    requiredColumns: ['mobile', 'email', 'commercialName'],
  },
  {
    id: 'bulk',
    icon: 'pi-cloud-upload',
    title: 'Upload Bulk',
    description: 'Import multiple customers at once from an Excel or CSV spreadsheet file.',
    accent: 'emerald',
  },
];

const ACCENT_STYLES: Record<CustomerActionDef['accent'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

/** Actions strip synchronized with CustomerStore and dynamic table columns. */
@Component({
  selector: 'app-customer-actions',
  templateUrl: './customer-actions.component.html',
  styleUrl: './customer-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActionsComponent {
  protected readonly cards = ACTION_CARDS;
  protected readonly store = inject(CustomerStore);
  private readonly messageService = inject(MessageService);

  protected accentStyle(accent: CustomerActionDef['accent']): string {
    return ACCENT_STYLES[accent];
  }

  protected onOpen(action: CustomerActionDef): void {
    const isCurrentlyActive = this.store.activeAction()?.id === action.id;
    this.store.selectAction(action);
    if (isCurrentlyActive) {
      this.messageService.add({
        severity: 'info',
        summary: action.title,
        detail: `Deactivated ${action.title} mode — table layout restored.`,
        life: 2500,
      });
    } else {
      this.messageService.add({
        severity: 'info',
        summary: action.title,
        detail: `Activated ${action.title} mode — table columns synchronized.`,
        life: 2500,
      });
    }
  }
}