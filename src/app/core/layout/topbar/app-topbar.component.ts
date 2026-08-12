import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

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
  template: `
    <header
      class="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6"
      role="banner"
    >
      <!-- Mobile hamburger / desktop collapse toggle -->
      <button
        type="button"
        (click)="menuToggle.emit()"
        [pTooltip]="'Toggle navigation'"
        tooltipPosition="bottom"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        aria-label="Toggle navigation menu"
      >
        <i class="pi pi-bars text-sm"></i>
      </button>

      <!-- Breadcrumb / page context -->
      <nav class="hidden min-w-0 items-center gap-2 text-sm md:flex" aria-label="Breadcrumb">
        <span class="font-medium text-slate-400">CRM</span>
        <i class="pi pi-angle-right text-[10px] text-slate-300" aria-hidden="true"></i>
        <span class="font-semibold text-slate-800">Customer Management</span>
      </nav>

      <!-- Global command / search area -->
      <div class="mx-auto hidden w-full max-w-md lg:block">
        <div class="relative">
          <i
            class="pi pi-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400"
            aria-hidden="true"
          ></i>
          <input
            type="search"
            placeholder="Search anything…  ( / )"
            aria-label="Global search"
            class="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
          <kbd
            class="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400"
            >/</kbd
          >
        </div>
      </div>

      <!-- Right cluster -->
      <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
        <p-select
          [options]="languages()"
          [(ngModel)]="selectedLanguage"
          optionLabel="label"
          optionValue="value"
          styleClass="h-9 w-[92px]"
          [showClear]="false"
          aria-label="Select language"
        >
          <ng-template #selectedItem let-option>
            <div class="flex items-center gap-2">
              <span class="text-sm">{{ option.label }}</span>
            </div>
          </ng-template>
        </p-select>

        <button
          type="button"
          (click)="onNotifications()"
          [pTooltip]="'Notifications'"
          tooltipPosition="bottom"
          class="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          aria-label="Notifications"
        >
          <i class="pi pi-bell text-base"></i>
          <span
            class="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
            aria-hidden="true"
          ></span>
        </button>

        <div class="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true"></div>

        <!-- User / profile -->
        <button
          type="button"
          class="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          aria-label="User profile menu"
        >
          <div class="hidden text-right sm:block">
            <div class="text-sm font-semibold leading-4 text-slate-800">Youssef Ahmed</div>
            <div class="text-[11px] leading-4 text-slate-400">Senior Sales Manager</div>
          </div>
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white"
            aria-hidden="true"
          >
            YA
          </div>
          <i
            class="pi pi-angle-down hidden text-[10px] text-slate-400 sm:block"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </header>
  `,
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
