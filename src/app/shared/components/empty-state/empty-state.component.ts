import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  imports: [ButtonModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div
        class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
        [attr.aria-hidden]="true"
      >
        <i [class]="icon()" class="pi text-2xl"></i>
      </div>
      <div class="text-base font-semibold text-slate-700">{{ title() }}</div>
      @if (description()) {
        <p class="max-w-sm text-sm text-slate-400">{{ description() }}</p>
      }
      @if (actionLabel() && !actionHidden()) {
        <p-button
          [label]="actionLabel()"
          [text]="true"
          size="small"
          icon="pi pi-refresh"
          (onClick)="action.emit()"
          class="mt-2"
        >
        </p-button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  readonly icon = input('pi-inbox');
  readonly title = input('No data found');
  readonly description = input('');
  readonly actionLabel = input('');
  readonly actionHidden = input(false);
  readonly action = output<void>();
}