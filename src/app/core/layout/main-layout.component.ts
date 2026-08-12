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

  /** Topbar hamburger — only visible on small screens, opens the drawer. */
  protected onMenuToggle(): void {
    this.mobileOpen.set(true);
  }

  /** Sidebar collapse arrow — desktop only, toggles the icon rail. */
  protected onDesktopCollapse(): void {
    this.desktopCollapsed.update((value) => !value);
  }
}
