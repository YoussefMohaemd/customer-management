import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppSidebarComponent } from '@core/layout/sidebar/app-sidebar.component';
import { AppTopbarComponent } from '@core/layout/topbar/app-topbar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, AppSidebarComponent, AppTopbarComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-100">
      <!-- Desktop sidebar -->
      <div class="hidden lg:block" [class]="desktopCollapsed() ? 'w-[76px]' : 'w-64'">
        <app-sidebar [collapsed]="desktopCollapsed()" />
      </div>

      <!-- Mobile drawer -->
      @if (mobileOpen()) {
        <div
          class="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          (click)="mobileOpen.set(false)"
          role="presentation"
        ></div>
        <div class="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
          <app-sidebar [collapsed]="false" />
        </div>
      }

      <!-- Main column -->
      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar (menuToggle)="onMenuToggle()" />
        <main class="min-h-0 flex-1 overflow-y-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  protected readonly desktopCollapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  protected onMenuToggle(): void {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      this.desktopCollapsed.update((value) => !value);
    } else {
      this.mobileOpen.set(true);
    }
  }
}