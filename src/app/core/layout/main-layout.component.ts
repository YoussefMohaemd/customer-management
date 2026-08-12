import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppSidebarComponent } from '@core/layout/sidebar/app-sidebar.component';
import { AppTopbarComponent } from '@core/layout/topbar/app-topbar.component';

/**
 * App shell: fixed sidebar (desktop expandable / mobile drawer), top header
 * and a scrollable content area hosting the routed feature.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, AppSidebarComponent, AppTopbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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