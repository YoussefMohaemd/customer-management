import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

/**
 * App header: hamburger/collapse toggle, breadcrumb, global command/search
 * area, language selector, notifications and the user profile cluster.
 */
@Component({
  selector: 'app-topbar',
  imports: [
    FormsModule,
    SelectModule,
    TooltipModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './app-topbar.component.html',
  styleUrl: './app-topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppTopbarComponent {
  readonly menuToggle = output<void>();

  private readonly messageService = inject(MessageService);

  protected readonly languages = computed(() => [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ]);
  protected selectedLanguage = 'en';

  protected onNotifications(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Notifications',
      detail: 'You are up to date. No new notifications.',
      life: 2500,
    });
  }
}