import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

import { SIDEBAR_NAV_ITEMS } from '@core/config/navigation';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, TooltipModule],
  template: `
    <aside
      class="flex h-full flex-col bg-slate-900 text-slate-300 transition-[width] duration-200"
      [class.w-64]="!collapsed()"
      [class.w-[76px]]="collapsed()"
      [attr.aria-label]="'Main navigation'"
    >
      <!-- Brand -->
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-5" [class.justify-center]="collapsed()">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/40"
          [attr.aria-hidden]="true"
        >
          <i class="pi pi-building text-base"></i>
        </div>
        @if (!collapsed()) {
          <div class="min-w-0 leading-tight">
            <div class="truncate text-sm font-bold text-white">Enterprise CRM</div>
            <div class="truncate text-[11px] text-slate-400">Customer Management</div>
          </div>
        }
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Sidebar">
        <ul class="flex flex-col gap-1">
          @for (item of navigation(); track item.label) {
            <li>
              <a
                [routerLink]="item.routerLink"
                [attr.aria-current]="item.active ? 'page' : null"
                [pTooltip]="collapsed() ? item.label : ''"
                tooltipPosition="right"
                [class]="linkClass(item)"
                [class.disabled-click]="!item.enabled"
                (click)="onItemClick(item, $event)"
              >
                <i [class]="item.icon" class="pi shrink-0 text-base" [attr.aria-hidden]="true"></i>
                @if (item.active) {
                  <span
                    class="absolute -left-3 top-1/2 h-7 w-[5px] -translate-y-1/2 rounded-r-md bg-gradient-to-b from-blue-400 to-blue-600"
                    aria-hidden="true"
                  ></span>
                }
                @if (!collapsed()) {
                  <span class="truncate text-sm font-medium">{{ item.label }}</span>
                }
                @if (item.starred) {
                  <i
                    class="pi pi-star-fill ml-auto mr-3 shrink-0 text-[9px] text-amber-400"
                    [attr.aria-label]="'Active module'"
                  ></i>
                }
                @if (item.badge) {
                  <span
                    class="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                  >{{ item.badge }}</span>
                }
              </a>
            </li>
          }
        </ul>
      </nav>

      <!-- Footer -->
      <div class="border-t border-slate-800 p-4" [class.hidden]="collapsed()">
        <div class="flex items-center gap-2 text-[11px] text-slate-500">
          <i class="pi pi-shield text-xs" aria-hidden="true"></i>
          <span>ERP v21 · Production readiness</span>
        </div>
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
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
        life: 2600
      });
    }
  }
}