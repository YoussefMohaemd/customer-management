import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-flag',
  imports: [],
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm"
      [class.h-4]="size() === 'xs'"
      [class.w-4]="size() === 'xs'"
      [class.h-6]="size() === 'md'"
      [class.w-6]="size() === 'md'"
      [class.h-5]="size() === 'sm'"
      [class.w-5]="size() === 'sm'"
    >
      @switch (code()) {
        @case ('us') {
          <svg viewBox="0 0 40 40" class="h-full w-full" aria-hidden="true">
            <rect width="40" height="40" fill="#fff" />
            <rect y="3" width="40" height="3" fill="#b22234" />
            <rect y="9" width="40" height="3" fill="#b22234" />
            <rect y="15" width="40" height="3" fill="#b22234" />
            <rect y="21" width="40" height="3" fill="#b22234" />
            <rect y="27" width="40" height="3" fill="#b22234" />
            <rect y="33" width="40" height="3" fill="#b22234" />
            <rect width="17.5" height="21" fill="#3c3b6e" />
            <g fill="#fff">
              @for (x of [5, 12]; track x) {
                @for (y of [3, 9, 15]; track y) {
                  <circle [attr.cx]="x" [attr.cy]="y" r="1.1" />
                }
              }
              @for (x of [8.5, 15.5]; track x) {
                @for (y of [6, 12, 18]; track y) {
                  <circle [attr.cx]="x" [attr.cy]="y" r="1.1" />
                }
              }
            </g>
          </svg>
        }
        @case ('eg') {
          <svg viewBox="0 0 40 40" class="h-full w-full" aria-hidden="true">
            <rect width="40" height="13.34" fill="#ce1126" />
            <rect y="13.34" width="40" height="13.34" fill="#fff" />
            <rect y="26.66" width="40" height="13.34" fill="#000" />
          </svg>
        }
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlagComponent {
  readonly code = input.required<string>();
  readonly size = input<'xs' | 'sm' | 'md'>('md');
}
