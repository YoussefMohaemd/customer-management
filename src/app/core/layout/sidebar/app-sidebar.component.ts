import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

import { SIDEBAR_NAV_ITEMS } from '@core/config/navigation';

/**
 * Light ERP sidebar: white surface, black text and a baby-blue active state
 * driven by the current route (RouterLinkActive). A collapse arrow on desktop
 * (lg+) toggles the icon rail; rendered in a drawer on mobile by the main
 * layout.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TooltipModule],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent {
  readonly collapsed = input(false);

  readonly collapseToggle = output<void>();

  private readonly messageService = inject(MessageService);

  protected readonly navigation = computed(() => SIDEBAR_NAV_ITEMS);

  protected linkClass(item: (typeof SIDEBAR_NAV_ITEMS)[number], isActive: boolean): string {
    const base =
      'group relative mb-0.5 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60';
    if (item.enabled && isActive) {
      return `${base} bg-sky-50 text-sky-400`;
    }
    return `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
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
