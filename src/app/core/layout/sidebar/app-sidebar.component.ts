import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

import { SIDEBAR_NAV_ITEMS } from '@core/config/navigation';

/**
 * Dark ERP sidebar matching the assessment reference: brand block, rail with
 * an active-state indicator, star badge for the active module and version
 * footer. Collapses to an icon rail on desktop; rendered in a drawer on
 * mobile by the main layout.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, TooltipModule],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent {
  readonly collapsed = input(false);

  private readonly messageService = inject(MessageService);

  protected readonly navigation = computed(() => SIDEBAR_NAV_ITEMS);

  protected linkClass(item: (typeof SIDEBAR_NAV_ITEMS)[number]): string {
    const base =
      'group relative mb-0.5 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60';
    if (item.active) {
      return `${base} bg-blue-600/15 text-white`;
    }
    return `${base} text-slate-400 hover:bg-slate-800/70 hover:text-white`;
  }

  protected onItemClick(item: (typeof SIDEBAR_NAV_ITEMS)[number], event: Event): void {
    if (!item.enabled) {
      event.preventDefault();
      this.messageService.add({
        severity: 'info',
        summary: 'Module unavailable',
        detail: `${item.label} is not part of this technical assessment.`,
        life: 2600,
      });
    }
  }
}